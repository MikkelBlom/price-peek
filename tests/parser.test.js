const test = require("node:test");
const assert = require("node:assert/strict");
const { findMatches, convert, guessCurrency, parseFieldValue, formatMoney, formatArea, formatWeight } = require("../extension/src/parser.js");

const money = text => findMatches(text).filter(m => m.kind === "money").map(m => [m.currency, Math.round(m.value * 100) / 100]);
const krw = text => findMatches(text).filter(m => m.kind === "money" && m.currency === "KRW").map(m => m.value);
const measures = text => findMatches(text).filter(m => m.kind !== "money").map(m => [m.kind, Math.round(m.value)]);

test("won symbol and suffix forms", () => {
  assert.deepEqual(krw("₩1,500,000"), [1500000]);
  assert.deepEqual(krw("₩ 1.500.000"), [1500000]);
  assert.deepEqual(krw("￦350,000,000"), [350000000]);
  assert.deepEqual(krw("1,500,000원"), [1500000]);
  assert.deepEqual(krw("KRW 1.500.000"), [1500000]);
  assert.deepEqual(krw("1,500,000 KRW"), [1500000]);
  assert.deepEqual(krw("50,000 won"), [50000]);
  assert.deepEqual(krw("1,234,567.89원"), [1234568]);
});

test("plus sign", () => {
  const [m] = findMatches("₩1,500,000+ /30days");
  assert.equal(m.value, 1500000);
  assert.equal(m.plus, true);
});

test("zero is ignored", () => {
  assert.deepEqual(krw("Total ₩0"), []);
});

test("Korean units", () => {
  assert.deepEqual(krw("150만원"), [1500000]);
  assert.deepEqual(krw("3억 5,000만원"), [350000000]);
  assert.deepEqual(krw("3억5천만원"), [350000000]);
  assert.deepEqual(krw("3억 5천"), [350000000]);
  assert.deepEqual(krw("매매 12억 5,000"), [1250000000]);
  assert.deepEqual(krw("3.5억"), [350000000]);
  assert.deepEqual(krw("1,5억"), [150000000]);
  assert.deepEqual(krw("35,000만원"), [350000000]);
  assert.deepEqual(krw("월세 80만"), [800000]);
  assert.deepEqual(krw("5천원"), [5000]);
  assert.deepEqual(krw("150만 5천원"), [1505000]);
  assert.deepEqual(krw("1조 2,000억"), [1200000000000]);
  assert.deepEqual(krw("₩3억"), [300000000]);
  assert.deepEqual(krw("조회수 1.2만"), [12000]);
});

test("multiple prices and ranges", () => {
  assert.deepEqual(krw("보증금 1억 / 월세 80만"), [100000000, 800000]);
  assert.deepEqual(krw("3억~4억"), [300000000, 400000000]);
  assert.deepEqual(krw("12억 5,000 (전용 84㎡)"), [1250000000]);
});

test("Naver shopping text joined across flex items", () => {
  assert.deepEqual(krw("[올리브영기프트카드] 5만원권 (즉시사용"), [50000]);
  assert.deepEqual(krw("50,000 원"), [50000]);
  assert.deepEqual(krw("3% 48,500 원"), [48500]);
  // Coupang: "15" and "310,000원" in neighbouring flex items, joined with an en space
  assert.deepEqual(krw("15% 310,000원"), [310000]);
  assert.deepEqual(krw("15 310,000원"), [310000]);
  assert.deepEqual(krw("48,500 원"), [48500]);
});

test("dollars", () => {
  assert.deepEqual(money("$1,299.99"), [["USD", 1299.99]]);
  assert.deepEqual(money("US$ 45"), [["USD", 45]]);
  assert.deepEqual(money("$2.5M"), [["USD", 2500000]]);
  assert.deepEqual(money("$50K"), [["USD", 50000]]);
  assert.deepEqual(money("100 USD"), [["USD", 100]]);
  assert.deepEqual(money("20 dollars"), [["USD", 20]]);
  assert.deepEqual(money("1.2 million won"), [["KRW", 1200000]]);
});

test("other dollars are not USD", () => {
  assert.deepEqual(money("CA$20"), []);
  assert.deepEqual(money("A$20"), []);
  assert.deepEqual(money("HK$20"), []);
  assert.deepEqual(money("NT$300"), []);
});

test("euro, pound, franc", () => {
  assert.deepEqual(money("€19.99"), [["EUR", 19.99]]);
  assert.deepEqual(money("1.234,56 €"), [["EUR", 1234.56]]);
  assert.deepEqual(money("10,50 €"), [["EUR", 10.5]]);
  assert.deepEqual(money("EUR 3,5 Mio."), [["EUR", 3500000]]);
  assert.deepEqual(money("£12"), [["GBP", 12]]);
  assert.deepEqual(money("CHF 49.90"), [["CHF", 49.9]]);
});

test("yen and yuan", () => {
  assert.deepEqual(money("¥1,200"), [["JPY", 1200]]);
  assert.deepEqual(money("1,200円"), [["JPY", 1200]]);
  assert.deepEqual(money("3万円"), [["JPY", 30000]]);
  assert.deepEqual(money("1億2000万円"), [["JPY", 120000000]]);
  assert.deepEqual(money("5千円"), [["JPY", 5000]]);
  assert.deepEqual(money("CN¥88"), [["CNY", 88]]);
  assert.deepEqual(money("RMB 500"), [["CNY", 500]]);
  assert.deepEqual(money("100万元"), [["CNY", 1000000]]);
  assert.deepEqual(money("35元"), [["CNY", 35]]);
  assert.deepEqual(money("3万人"), []); // a count of people, not money
});

test("Nordic and Thai", () => {
  assert.deepEqual(money("499 SEK"), [["SEK", 499]]);
  assert.deepEqual(money("NOK 1 200"), [["NOK", 1200]]);
  assert.deepEqual(money("12 500,50 €"), [["EUR", 12500.5]]);
  assert.deepEqual(money("DKK 250"), [["DKK", 250]]);
  assert.deepEqual(money("฿350"), [["THB", 350]]);
  assert.deepEqual(money("350 บาท"), [["THB", 350]]);
  assert.deepEqual(money("350 baht"), [["THB", 350]]);
  assert.deepEqual(money("299 kr."), []); // bare kr is ambiguous
});

test("non-prices are not matched", () => {
  assert.deepEqual(money("2024년 10월"), []);
  assert.deepEqual(money("she won 3 games"), []);
  assert.deepEqual(money("5천명"), []);
  assert.deepEqual(money("EN | KRW"), []);
  assert.deepEqual(money("EURO 2024"), []);
});

test("area and weight, metric only", () => {
  assert.deepEqual(measures("25평"), [["area", 83]]);
  assert.deepEqual(measures("30평대 아파트"), [["area", 99]]);
  assert.deepEqual(measures("평균 5평균"), []);
  assert.deepEqual(measures("40坪"), [["area", 132]]);
  assert.deepEqual(measures("6畳"), [["area", 10]]);
  assert.deepEqual(measures("8帖"), [["area", 13]]);
  assert.deepEqual(measures("삼겹살 1근"), [["weight", 600]]);
  assert.deepEqual(measures("3근무"), []);
  assert.deepEqual(measures("800 sq ft · 5 lbs"), []);
});

test("typed values in form fields", () => {
  const field = (v, ctx) => { const m = parseFieldValue(v, ctx); return m && [m.currency, m.value]; };
  assert.deepEqual(field("500000", "최소 원 ~ 최대 원"), ["KRW", 500000]);
  assert.deepEqual(field("1,200", "Max price ($)"), ["USD", 1200]);
  assert.deepEqual(field("50만", ""), ["KRW", 500000]);
  assert.deepEqual(field("₩300,000", "Budget"), ["KRW", 300000]);
  assert.equal(field("500000", "Quantity"), null);
  // translated page: "원 ~ 원" became "one ~ one"; the page's main currency fills in
  assert.deepEqual((m => [m.currency, m.value])(parseFieldValue("500000", "~onesearch", "KRW")), ["KRW", 500000]);
  assert.equal(field("hello", "원"), null);
  assert.equal(guessCurrency("Price in EUR"), "EUR");
  assert.equal(guessCurrency("Europe"), null);
});

test("conversion through EUR-based rates", () => {
  const rates = { EUR: 1, DKK: 7.46, KRW: 1495, USD: 1.08 };
  assert.equal(Math.round(convert(1500000, "KRW", "DKK", rates)), 7485);
  assert.equal(Math.round(convert(100, "USD", "DKK", rates)), 691);
  assert.equal(convert(5, "DKK", "DKK", rates), 5);
  assert.ok(Number.isNaN(convert(5, "THB", "DKK", rates)));
});

test("formatting", () => {
  assert.equal(formatMoney(7041), "7.041 kr.");
  assert.equal(formatMoney(7041, "DKK", true), "7.041+ kr.");
  assert.equal(formatMoney(6412300), "6,4 mio. kr.");
  assert.equal(formatMoney(152300000), "152 mio. kr.");
  assert.equal(formatMoney(2.1e9), "2,1 mia. kr.");
  assert.equal(formatMoney(4.694), "4,69 kr.");
  assert.equal(formatMoney(944.2, "EUR"), "€944");
  assert.equal(formatMoney(2500000, "USD"), "$2,5 mio.");
  assert.equal(formatMoney(1234, "SEK"), "1.234 SEK");
  assert.equal(formatArea(82.6), "83 m²");
  assert.equal(formatArea(6.4), "6,4 m²");
  assert.equal(formatWeight(600), "600 g");
  assert.equal(formatWeight(1800), "1,8 kg");
});
