# Contributing to Price Peek

Thanks for helping. Issues and pull requests are welcome.

## Report something

[Open an issue](../../issues/new/choose) and pick the type that fits:

- **Bug report** – a price that gets the wrong amount, no badge, or a badge where there shouldn't be one. The exact price text and the page address help most.
- **Currency or language request** – a currency, number format or unit Price Peek should understand, or a language for the popup.
- **Feature request** – anything else you'd like it to do.

## Send a pull request

1. Fork the repo and make your change on a branch.
2. Price detection lives in `extension/src/parser.js`. Add a test for any new format to `tests/parser.test.js` and run:
   ```bash
   node --test tests/parser.test.js
   ```
3. Load the `extension` folder unpacked in `chrome://extensions` and check the change on a real page.
4. Open the pull request and describe what changed and why.

Keep units metric only: Price Peek doesn't convert to or from feet, inches, pounds or other imperial units.

## License

Price Peek is not open source; see [LICENSE](LICENSE). Forking is allowed only to send pull requests back here, and by contributing you agree your contribution can be used in Price Peek.
