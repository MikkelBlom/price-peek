const test = require("node:test");
const assert = require("node:assert/strict");
const { findMatches, formatDkk, formatArea } = require("../extension/src/parser.js");

const values = text => findMatches(text).map(m => [m.kind, Math.round(m.value)]);
const krw = text => findMatches(text).filter(m => m.kind === "krw").map(m => m.value);

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

test("plus sign and period suffix", () => {
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
});

test("English multipliers", () => {
  assert.deepEqual(krw("1.2 million won"), [1200000]);
  assert.deepEqual(krw("KRW 2.3bn"), [2300000000]);
});

test("non-prices are not matched", () => {
  assert.deepEqual(krw("2024년 10월"), []);
  assert.deepEqual(krw("she won 3 games"), []);
  assert.deepEqual(krw("5천명"), []);
  assert.deepEqual(krw("EN | KRW"), []);
});

test("pyeong area", () => {
  assert.deepEqual(values("25평"), [["area", 83]]);
  assert.deepEqual(values("30평대 아파트"), [["area", 99]]);
  assert.deepEqual(values("평균 5평균"), []);
});

test("DKK formatting", () => {
  assert.equal(formatDkk(7041), "7.041 kr.");
  assert.equal(formatDkk(7041, true), "7.041+ kr.");
  assert.equal(formatDkk(6412300), "6,4 mio. kr.");
  assert.equal(formatDkk(152300000), "152 mio. kr.");
  assert.equal(formatDkk(2.1e9), "2,1 mia. kr.");
  assert.equal(formatDkk(4.694), "4,69 kr.");
  assert.equal(formatArea(82.6), "83 m²");
});
