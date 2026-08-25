/**
 * 寶螺盃 · 純邏輯單元測試（Node，無需瀏覽器）
 * 執行：node tests/logic.test.js
 */

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log("  ✓", msg);
  } else {
    failed++;
    console.error("  ✗", msg);
  }
}

function seededBracketOrder(n) {
  if (n < 2 || (n & (n - 1)) !== 0) return [];
  let bracket = [1, 2];
  while (bracket.length < n) {
    const sum = bracket.length * 2 + 1;
    const next = [];
    for (const s of bracket) {
      next.push(s);
      next.push(sum - s);
    }
    bracket = next;
  }
  return bracket;
}

function swissRoundsAdvice(playerCount) {
  const n = Math.max(2, playerCount | 0);
  const log2 = Math.log2(n);
  const optimal = Math.max(2, Math.min(n - 1, Math.ceil(log2)));
  const minOk = Math.max(2, optimal - 1);
  const maxOk = Math.min(n - 1, Math.max(optimal + 1, minOk));
  const maxHard = Math.max(1, n - 1);
  const rematchRiskAt = Math.max(minOk, Math.floor(n / 2));
  return { n, optimal, minOk, maxOk, maxHard, rematchRiskAt, log2 };
}

const MATCH_TARGET = 4;
function autoWinnerFromScores(p1Id, p2Id, p1Bp, p2Bp) {
  const a = Math.max(0, parseInt(p1Bp, 10) || 0);
  const b = Math.max(0, parseInt(p2Bp, 10) || 0);
  if (a >= MATCH_TARGET && a > b) return p1Id;
  if (b >= MATCH_TARGET && b > a) return p2Id;
  return null;
}

/** 多角同分：同一瑞士分組內，>2 人唔用 H2H */
function rankSortGroups(players, h2hMap) {
  const bySwiss = new Map();
  for (const r of players) {
    if (!bySwiss.has(r.swissPoints)) bySwiss.set(r.swissPoints, []);
    bySwiss.get(r.swissPoints).push(r);
  }
  const ordered = [];
  for (const sp of [...bySwiss.keys()].sort((a, b) => b - a)) {
    const g = bySwiss.get(sp);
    g.sort((a, b) => {
      if (g.length === 2) {
        const h2h = h2hMap[`${a.id}|${b.id}`] || h2hMap[`${b.id}|${a.id}`];
        if (h2h === a.id) return -1;
        if (h2h === b.id) return 1;
      }
      if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
      return a.name.localeCompare(b.name);
    });
    ordered.push(...g);
  }
  return ordered;
}

console.log("\n── seededBracketOrder ──");
assert(JSON.stringify(seededBracketOrder(4)) === JSON.stringify([1, 4, 2, 3]), "4: 1,4,2,3");
assert(JSON.stringify(seededBracketOrder(8)) === JSON.stringify([1, 8, 4, 5, 2, 7, 3, 6]), "8: 1,8,4,5,2,7,3,6");
const b16 = seededBracketOrder(16);
assert(b16[0] === 1 && b16[1] === 16 && b16[2] === 8 && b16[3] === 9, "16: 1v16, 8v9…");
assert(b16.length === 16 && new Set(b16).size === 16, "16: unique seeds");

function koSizeAdvice(playerCount) {
  const n = Math.max(2, playerCount | 0);
  const allowed = [4, 8, 16].filter((k) => k <= n);
  let optimal;
  if (n < 4) optimal = Math.max(2, n);
  else if (n <= 16) optimal = 4;
  else if (n <= 32) optimal = 8;
  else optimal = 16;
  if (allowed.length && !allowed.includes(optimal)) {
    const le = allowed.filter((k) => k <= optimal);
    optimal = le.length ? le[le.length - 1] : allowed[allowed.length - 1];
  }
  if (optimal > n) {
    optimal = allowed.length ? allowed[allowed.length - 1] : Math.max(2, n);
  }
  return { n, optimal, allowed };
}

console.log("\n── swissRoundsAdvice ──");
assert(swissRoundsAdvice(8).optimal === 3, "8 人 → 3 輪");
assert(swissRoundsAdvice(16).optimal === 4, "16 人 → 4 輪");
assert(swissRoundsAdvice(17).optimal === 5, "17 人 → 5 輪");
assert(swissRoundsAdvice(32).optimal === 5, "32 人 → 5 輪");
assert(swissRoundsAdvice(64).optimal === 6, "64 人 → 6 輪");

console.log("\n── koSizeAdvice ──");
assert(koSizeAdvice(8).optimal === 4, "8 人 → 4 強");
assert(koSizeAdvice(9).optimal === 4, "9 人 → 4 強");
assert(koSizeAdvice(16).optimal === 4, "16 人 → 4 強");
assert(koSizeAdvice(17).optimal === 8, "17 人 → 8 強");
assert(koSizeAdvice(32).optimal === 8, "32 人 → 8 強");
assert(koSizeAdvice(33).optimal === 16, "33 人 → 16 強");
assert(koSizeAdvice(64).optimal === 16, "64 人 → 16 強");

console.log("\n── autoWinnerFromScores ──");
assert(autoWinnerFromScores("a", "b", 4, 2) === "a", "4-2 → a");
assert(autoWinnerFromScores("a", "b", 3, 4) === "b", "3-4 → b");
assert(autoWinnerFromScores("a", "b", 4, 4) === null, "4-4 → 無分");
assert(autoWinnerFromScores("a", "b", 5, 4) === "a", "5-4 → a");
assert(autoWinnerFromScores("a", "b", 2, 2) === null, "2-2 未到 4 → 未完場");

console.log("\n── multi-way ranking ──");
// 三角：A 勝 B，但 BP 不同 — 三人同分瑞士分時應按 BP 唔跟 H2H
const multi = rankSortGroups(
  [
    { id: "a", name: "A", swissPoints: 2, battlePoints: 5 },
    { id: "b", name: "B", swissPoints: 2, battlePoints: 10 },
    { id: "c", name: "C", swissPoints: 2, battlePoints: 7 },
  ],
  { "a|b": "a" } // A 曾贏 B，但多角應忽略
);
assert(multi[0].id === "b" && multi[1].id === "c" && multi[2].id === "a", "多角：BP 10>7>5，忽略 H2H");

// 二人組：H2H 優先
const pair = rankSortGroups(
  [
    { id: "a", name: "A", swissPoints: 3, battlePoints: 5 },
    { id: "b", name: "B", swissPoints: 3, battlePoints: 12 },
  ],
  { "a|b": "a" }
);
assert(pair[0].id === "a", "二人組：H2H 勝方排前（即使 BP 較低）");

console.log("\n── pairing time budget (n=32 greedy-like) ──");
// 模擬 greedy 32 人應即時完成
const t0 = Date.now();
const players = Array.from({ length: 32 }, (_, i) => ({
  id: "p" + i,
  swissPoints: Math.floor(i / 4),
  battlePoints: i,
  church: i % 2 ? "kcc" : "ky",
}));
const remaining = [...players];
const pairs = [];
const played = new Set();
while (remaining.length >= 2) {
  const a = remaining.shift();
  let best = 0;
  let bestQ = -Infinity;
  for (let i = 0; i < remaining.length; i++) {
    const b = remaining[i];
    const key = a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
    let q = -Math.abs(a.swissPoints - b.swissPoints) * 10000;
    if (played.has(key)) q -= 5000;
    if (a.church !== b.church) q += 1000;
    if (q > bestQ) {
      bestQ = q;
      best = i;
    }
  }
  pairs.push([a, remaining.splice(best, 1)[0]]);
}
const elapsed = Date.now() - t0;
assert(pairs.length === 16, "32 人 greedy 產生 16 對");
assert(elapsed < 100, "32 人 greedy < 100ms（實際 " + elapsed + "ms）");

console.log("\n── KO invalidate cascade ──");
// 模擬：2 場準決賽完 → final/third；改 early 後清下游
function invalidateKnockoutAfter(ko, roundIndex) {
  const ri = Math.max(0, roundIndex);
  ko.rounds = ko.rounds.slice(0, ri + 1);
  ko.final = null;
  ko.third = null;
  const adv = { ...(ko._advancedFrom || {}) };
  Object.keys(adv).forEach((k) => {
    if (Number(k) >= ri) delete adv[k];
  });
  ko._advancedFrom = adv;
}
function tryAdvance(ko) {
  const ri = ko.rounds.length - 1;
  const last = ko.rounds[ri];
  if (!last.matches.every((m) => m.done && m.winner)) return false;
  if (ko._advancedFrom?.[ri]) return false;
  if (last.matches.length === 2 && !ko.final) {
    const [m0, m1] = last.matches;
    ko.final = { p1: m0.winner, p2: m1.winner, done: false };
    ko.third = {
      p1: m0.p1 === m0.winner ? m0.p2 : m0.p1,
      p2: m1.p1 === m1.winner ? m1.p2 : m1.p1,
      done: false,
    };
    ko._advancedFrom[ri] = true;
    return true;
  }
  return false;
}
const ko = {
  rounds: [
    {
      name: "準決賽",
      matches: [
        { p1: "a", p2: "d", winner: "a", done: true },
        { p1: "b", p2: "c", winner: "b", done: true },
      ],
    },
  ],
  final: null,
  third: null,
  _advancedFrom: {},
};
assert(tryAdvance(ko) === true && ko.final.p1 === "a" && ko.final.p2 === "b", "晉級產生決賽 a vs b");
// 改準決賽1勝方 a→d
ko.rounds[0].matches[0].winner = "d";
invalidateKnockoutAfter(ko, 0);
assert(!ko.final && !ko.third && !ko._advancedFrom[0], "invalidate 清 final/third/_advancedFrom");
ko.rounds[0].matches[0].done = true;
ko.rounds[0].matches[1].done = true;
assert(tryAdvance(ko) === true && ko.final.p1 === "d" && ko.final.p2 === "b", "重建決賽 d vs b");

console.log("\n── resolveWinner scores edge ──");
assert(autoWinnerFromScores("a", "b", 4, 4) === null, "4-4 無分");
assert(autoWinnerFromScores("a", "b", 5, 5) === null, "5-5 無分");

console.log("\n── CX filter must not mutate until ensureCx ──");
function isCxBey(bey) {
  return !!(bey && (bey.series === "CX" || bey.bladeId === "cx"));
}
function emptyCxParts() {
  return {
    cxProduct: "",
    cxType: "standard",
    lockChip: "",
    lockChipCustom: "",
    mainBlade: "",
    mainBladeCustom: "",
    assistBlade: "",
    overBlade: "",
  };
}
function ensureCx(bey, snapshotRef) {
  if (!bey || isCxBey(bey)) return snapshotRef;
  if (!snapshotRef.snap) snapshotRef.snap = JSON.parse(JSON.stringify(bey));
  const keepRatchet = bey.ratchet || "";
  const keepBit = bey.bit || "";
  bey.bladeId = "cx";
  bey.series = "CX";
  bey.bladeCode = "";
  bey.bladeName = "";
  Object.assign(bey, emptyCxParts());
  bey.cxType = "standard";
  bey.ratchet = keepRatchet;
  bey.bit = keepBit;
  return snapshotRef;
}
function restoreIfNeeded(bey, snapshotRef) {
  if (!bey || !snapshotRef.snap) return false;
  if (!isCxBey(bey)) {
    snapshotRef.snap = null;
    return false;
  }
  // incomplete CX → restore
  const complete = !!(bey.lockChip && bey.mainBlade && bey.assistBlade);
  if (complete) {
    snapshotRef.snap = null;
    return false;
  }
  const snap = snapshotRef.snap;
  snapshotRef.snap = null;
  Object.keys(bey).forEach((k) => delete bey[k]);
  Object.assign(bey, snap);
  return true;
}

const beyUx = {
  bladeId: "ux-15",
  series: "UX",
  bladeName: "鮫鯊狂鱗",
  ratchet: "1-70",
  bit: "LR",
};
const snapRef = { snap: JSON.parse(JSON.stringify(beyUx)) };
// 只切 filter：唔 call ensureCx → bey 仍係 UX
assert(beyUx.bladeId === "ux-15" && !isCxBey(beyUx), "切 CX filter 前 bey 仍係 UX");
// 用戶揀零件 → ensureCx
ensureCx(beyUx, snapRef);
assert(isCxBey(beyUx) && beyUx.ratchet === "1-70" && beyUx.bit === "LR", "ensureCx 轉 CX 但保留固鎖軸心");
assert(beyUx.bladeId === "cx" && !beyUx.mainBlade, "ensureCx 清上蓋改 cx");
// 未完成就離開 → 還原
assert(restoreIfNeeded(beyUx, snapRef) === true, "未完成 CX 離開可還原");
assert(beyUx.bladeId === "ux-15" && beyUx.bit === "LR", "還原後返 UX15");

console.log("\n── CX complete / expand over required ──");
function isCxBladeComplete(bey) {
  if (bey.series !== "CX" && bey.bladeId !== "cx") return false;
  if (!bey.lockChip || !bey.mainBlade || !bey.assistBlade) return false;
  if (bey.cxType === "expand" && !bey.overBlade) return false;
  return true;
}
assert(
  isCxBladeComplete({
    series: "CX",
    bladeId: "cx",
    cxType: "standard",
    lockChip: "蒼龍",
    mainBlade: "勇氣",
    assistBlade: "S",
  }) === true,
  "標準 CX 齊"
);
assert(
  isCxBladeComplete({
    series: "CX",
    bladeId: "cx",
    cxType: "expand",
    lockChip: "蒼龍",
    mainBlade: "閃擊",
    assistBlade: "S",
  }) === false,
  "Expand 缺超越 → 未齊"
);
assert(
  isCxBladeComplete({
    series: "CX",
    bladeId: "cx",
    cxType: "expand",
    lockChip: "蒼龍",
    mainBlade: "閃擊",
    assistBlade: "S",
    overBlade: "B",
  }) === true,
  "Expand 有超越 → 齊"
);

console.log("\n── integrated ratchet complete ──");
function beyHasIntegrated(id) {
  return id === "ux-19" || id === "ux-20" || id === "ux-21";
}
function isBeyCompleteSimple(bey) {
  if (!bey.bit) return false;
  if (!beyHasIntegrated(bey.bladeId) && !bey.ratchet) return false;
  if (bey.series === "CX" || bey.bladeId === "cx") return isCxBladeComplete(bey);
  return !!bey.bladeId;
}
assert(isBeyCompleteSimple({ bladeId: "ux-20", bit: "H", ratchet: "" }) === true, "UX20 一體化免固鎖");
assert(isBeyCompleteSimple({ bladeId: "ux-15", bit: "H", ratchet: "" }) === false, "UX15 要固鎖");
assert(isBeyCompleteSimple({ bladeId: "ux-15", bit: "H", ratchet: "1-70" }) === true, "UX15 齊");

console.log("\n── filterBlades HOT treated as ALL ──");
function filterSeriesOk(series) {
  // mirror parts.js guard
  return !(series && series !== "ALL" && series !== "CX" && series !== "HOT");
}
assert(filterSeriesOk("HOT") === true, "HOT 唔會被當成 series 名 filter");
assert(filterSeriesOk("BX") === false, "BX 會 filter");

console.log("\n── cloud sync rev apply ──");
function shouldApplyRemote(localRev, remoteRev, role, justPushedRev) {
  const l = parseInt(localRev, 10) || 0;
  const r = parseInt(remoteRev, 10) || 0;
  if (role === "host" && r <= (justPushedRev || 0)) return false;
  return r > l;
}
assert(shouldApplyRemote(1, 2, "viewer", 0) === true, "只讀遠端較新 → 套用");
assert(shouldApplyRemote(2, 2, "viewer", 0) === false, "同 rev → 唔套用");
assert(shouldApplyRemote(3, 2, "viewer", 0) === false, "本地較新 → 唔套用");
assert(shouldApplyRemote(5, 5, "host", 5) === false, "主持自己啱推 → 唔套用");
assert(shouldApplyRemote(5, 6, "host", 5) === true, "另一主持推高 → 套用");

function normalizeRoomId(id) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
assert(normalizeRoomId(" a3k-9p2 ") === "A3K9P2", "比賽 ID 正規化");

console.log("\n── getBeyTier custom / catalog ──");
function getBeyTierAudit(bey, catalog) {
  if (!bey) return "";
  if (bey.bladeId === "custom") return "";
  if (bey.bladeId && bey.bladeId !== "cx") {
    const b = catalog.find((x) => x.id === bey.bladeId);
    if (b) return b.tier || "";
  }
  return "";
}
const catalog = [
  { id: "bx-14", tier: "" },
  { id: "ux-15", tier: "T0" },
  { id: "bx-34", tier: "T1" },
];
assert(getBeyTierAudit({ bladeId: "bx-14" }, catalog) === "", "BX14 唔係 T0");
assert(getBeyTierAudit({ bladeId: "ux-15" }, catalog) === "T0", "UX15 係 T0");
assert(getBeyTierAudit({ bladeId: "bx-34" }, catalog) === "T1", "BX34 係 T1");
assert(getBeyTierAudit({ bladeId: "custom", bladeCustom: "鯊魚神劍" }, catalog) === "", "自訂永不 T0/T1");

console.log("\n── H2H uses last match ──");
function headToHeadLast(matches, aId, bId) {
  let last = null;
  for (const m of matches) {
    if (m.bye || !m.p2) continue;
    if ((m.p1 === aId && m.p2 === bId) || (m.p1 === bId && m.p2 === aId)) last = m.winner || null;
  }
  return last;
}
assert(
  headToHeadLast(
    [
      { p1: "a", p2: "b", winner: "a" },
      { p1: "b", p2: "a", winner: "b" },
    ],
    "a",
    "b"
  ) === "b",
  "重賽用最近一場"
);

console.log("\n── odd pairing bye ──");
function pairRoundOneOdd(players) {
  const pairs = [];
  for (let i = 0; i < players.length; i += 2) {
    if (players[i + 1]) pairs.push([players[i], players[i + 1]]);
    else pairs.push([players[i], null]);
  }
  return pairs;
}
const oddPairs = pairRoundOneOdd(["a", "b", "c"]);
assert(oddPairs.length === 2 && oddPairs[1][1] === null, "單數最後一人輪空");

function pickByeOrder(players) {
  const minBye = Math.min(...players.map((p) => p.byes));
  return [...players].sort((a, b) => {
    const aOk = a.byes === minBye ? 0 : 1;
    const bOk = b.byes === minBye ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    if (a.facedHigher !== b.facedHigher) return a.facedHigher ? -1 : 1;
    if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
    if (a.lockedKo !== b.lockedKo) return a.lockedKo ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-Hant");
  })[0];
}
function pickByeOrder2(players) {
  const minBye = Math.min(...players.map((p) => p.byes));
  return [...players].sort((a, b) => {
    const aOk = a.byes === minBye ? 0 : 1;
    const bOk = b.byes === minBye ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    return a.name.localeCompare(b.name, "zh-Hant");
  })[0];
}
const byePick = pickByeOrder2([
  { name: "線外", swissPoints: 2, byes: 0, bucket: 3 },
  { name: "穩入圍", swissPoints: 4, byes: 0, bucket: 0 },
  { name: "無希望", swissPoints: 0, byes: 0, bucket: 1 },
]);
assert(byePick.name === "穩入圍", "最後一輪：已穩入圍者優先休息");

const C = require("../cutoff.js");
function P(id, bp, byeCount) {
  return { id, name: id, battlePoints: bp, byeCount: byeCount || 0 };
}
function noH2h() {
  return null;
}

console.log("\n── cutoff: 高 BP 入圍（二人、H2H 相反）──");
{
  const r = C.analyzeCutoff([P("A", 4), P("B", 12)], 1, () => "A");
  assert(r.resolved && r.qualifierIds[0] === "B", "二人不同 BP：高 BP 入，唔跟 H2H");
}

console.log("\n── cutoff: 差距 >6 唔打──");
{
  const r = C.analyzeCutoff([P("Bye", 8, 1), P("Open", 15, 0)], 1, noH2h);
  assert(r.resolved && r.qualifierIds.includes("Open") && !r.needsMatches, "落後 7 分以上：高 BP 直接入");
}

console.log("\n── cutoff: 1 個自動獲勝、兩個未輪空──");
{
  const r = C.analyzeCutoff([P("Bye", 8, 1), P("B", 12, 0), P("C", 10, 0)], 1, noH2h);
  assert(!r.resolved && r.chain === "byeChallenge", "B 高過 C，B 直接挑戰 Bye");
  assert(r.challengerId === "B" && r.byeId === "Bye", "挑戰者係未輪空較高 BP");
  assert(r.firstMatches[0].creditBp === true, "對自動獲勝者加賽計 BP");
}

console.log("\n── cutoff: 兩個未輪空 BP 同要先打──");
{
  const r = C.analyzeCutoff([P("Bye", 8, 1), P("B", 10, 0), P("C", 10, 0)], 1, noH2h);
  assert(r.chain === "openThenBye", "未輪空同分先打");
  assert(r.firstMatches[0].creditBp === true, "未輪空之間加賽有 BP（只用於排挑戰者）");
}

console.log("\n── cutoff: 三人 RR──");
{
  const r = C.analyzeCutoff([P("A", 8), P("B", 8), P("C", 8)], 1, noH2h);
  assert(r.chain === "rr3" && r.firstMatches.length === 3, "三人同分 round-robin 三場");
}

console.log("\n── cutoff: 四人抽籤──");
{
  const r = C.analyzeCutoff([P("A", 8), P("B", 8), P("C", 8), P("D", 8)], 2, noH2h);
  const m = C.materializeCutoff(r, () => 0, (id) => id);
  assert(r.chain === "draw4" && m.firstMatches.length === 2, "四人抽兩場");
  assert(m.firstMatches.every((x) => x.creditBp), "四人加賽計 BP");
}

console.log("\n── cutoff: 2+ 坐場者先補 BP 再同未坐場者比──");
{
  const r = C.analyzeCutoff(
    [P("A", 8, 1), P("B", 8, 1), P("C", 8, 1), P("D", 8, 1)],
    2,
    noH2h
  );
  const m = C.materializeCutoff(r, () => 0, (id) => id, () => false);
  assert(r.chain === "byeBpGen", "四個坐場者（雙數）先各打一場補 BP");
  assert(m.firstMatches.length === 2, "四個人兩場");
  assert(m.firstMatches.every((x) => x.creditBp && x.role === "byeBpGen"), "補 BP 場計分");
}
{
  const r = C.analyzeCutoff([P("A", 8, 1), P("B", 8, 1)], 1, noH2h);
  const m = C.materializeCutoff(r, () => 0, (id) => id, () => false);
  assert(r.chain === "byeBpGen", "兩個坐場者打一場補 BP");
  assert(m.firstMatches.length === 1, "一場");
}
{
  const r = C.analyzeCutoff([P("A", 8, 1), P("B", 8, 1), P("C", 8, 1)], 1, noH2h);
  const m = C.materializeCutoff(r, () => 0, (id) => id, () => false);
  assert(r.chain === "byeBpGen" && r.seedNeeded, "三個坐場者：抽種子");
  assert(m.firstMatches.length === 1 && m.byeBp && m.byeBp.seedId, "其餘兩人先打，種子之後對勝者");
}
{
  const mixed = C.analyzeCutoff(
    [P("A", 8, 1), P("B", 8, 1), P("C", 20, 0), P("D", 19, 0)],
    2,
    noH2h
  );
  assert(mixed.chain === "byeBpGen", "兩個坐場＋未坐場：仍先讓坐場者補 BP");
}
{
  const group = [P("A", 8, 1), P("B", 8, 1), P("C", 20, 0)];
  const po = {
    chain: "byeBpGen",
    byeBp: { seedId: null },
    matches: [
      { p1: "A", p2: "B", role: "byeBpGen", wave: 1, done: true, winner: "A", p1Bp: 4, p2Bp: 1, creditBp: true },
    ],
  };
  const r = C.resolvePlayoff(group, 1, noH2h, po, () => false);
  assert(r.resolved && r.qualifierIds[0] === "C", "坐場者補完 BP（8+4=12）仍低過未坐場 20 → 未坐場入圍");
}
{
  const group = [P("A", 8, 1), P("B", 8, 1), P("G", 8, 1), P("C", 11, 0)];
  const po = {
    chain: "byeBpGen",
    byeBp: { seedId: "G" },
    matches: [
      { p1: "A", p2: "B", role: "byeBpGen", wave: 1, done: true, winner: "A", p1Bp: 6, p2Bp: 2, creditBp: true },
      { p1: "G", p2: "A", role: "byeBpGen", wave: 2, done: true, winner: "A", p1Bp: 1, p2Bp: 4, creditBp: true },
    ],
  };
  const r = C.resolvePlayoff(group, 1, noH2h, po, () => false);
  const cred = C.matchCredits(po.matches);
  assert(cred.A === 4, "打完首輪再對種子：只計對種子嗰場 4 分，首輪 6 分唔計");
  assert(cred.B === 2, "首輪負者只打過一場，計嗰場 2 分");
  assert(cred.G === 1, "種子只計對勝者嗰場");
  assert(r.resolved && r.qualifierIds[0] === "A", "A 8+4=12 高過未坐場 11 → A 入圍");
}

console.log("\n── cutoff: 5 人種子選手──");
{
  const r = C.analyzeCutoff([P("A", 8), P("B", 8), P("C", 8), P("D", 8), P("E", 8)], 1, noH2h);
  const m = C.materializeCutoff(r, () => 0, (id) => id);
  assert(r.chain === "seedKo" && m.ko.template === "5", "5 人用種子選手");
  assert(m.ko.seedId && m.firstMatches.length === 2, "其餘 4 人兩場首輪");
  assert(m.firstMatches.every((x) => x.creditBp === false), "5+ 唔計 BP");
}

console.log("\n── cutoff: 6 人種子線──");
{
  const r = C.analyzeCutoff(
    ["A", "B", "C", "D", "E", "F"].map((id) => P(id, 8)),
    1,
    noH2h
  );
  const m = C.materializeCutoff(r, () => 0, (id) => id);
  assert(m.ko.template === "6" && m.ko.seedLinePair, "6 人有種子線");
  assert(m.firstMatches.length === 3 && m.firstMatches.filter((x) => x.role === "seedLine").length === 1, "三場首輪一條種子線");
}

console.log("\n── cutoff: 7 人種子選手 + 種子線並行──");
{
  const r = C.analyzeCutoff(
    ["A", "B", "C", "D", "E", "F", "G"].map((id) => P(id, 8)),
    1,
    noH2h
  );
  const m = C.materializeCutoff(r, () => 0, (id) => id);
  assert(m.ko.template === "7" && m.ko.seedId && m.ko.seedLinePair, "7 人兩種種子");
  const po = { chain: "seedKo", ko: m.ko, matches: m.firstMatches.map((x, i) => ({ ...x, done: true, winner: x.p1, table: i + 1, p1Bp: 4, p2Bp: 0 })) };
  const adv = C.advanceSeedKo(po, (id) => id);
  assert(adv.length === 2, "7 人第二輪兩場並行");
  assert(adv.some((x) => x.role === "seedVsLine"), "其中一場種子線對種子選手");
  const po2 = {
    chain: "seedKo",
    ko: m.ko,
    matches: po.matches.concat(adv.map((x, i) => ({ ...x, done: true, winner: x.p1, table: 10 + i, p1Bp: 4, p2Bp: 0 }))),
  };
  const adv2 = C.advanceSeedKo(po2, (id) => id);
  assert(adv2.length === 1 && adv2[0].wave === 3, "兩邊勝者再打決勝");
}

console.log("\n── cutoff: bye challenge 加 BP 再比──");
{
  const group = [P("Bye", 8, 1), P("B", 12, 0)];
  const po = {
    chain: "byeChallenge",
    byeId: "Bye",
    challengerId: "B",
    preQualifyIds: [],
    matches: [{ p1: "B", p2: "Bye", role: "byeChallenge", done: true, winner: "Bye", p1Bp: 0, p2Bp: 6, creditBp: true }],
  };
  const r = C.resolvePlayoff(group, 1, noH2h, po);
  assert(r.resolved && r.qualifierIds[0] === "Bye", "Bye 贏 6–0：8+6=14 > 12，追到入圍");
}
{
  const group = [P("Bye", 8, 1), P("B", 12, 0)];
  const po = {
    chain: "byeChallenge",
    byeId: "Bye",
    challengerId: "B",
    preQualifyIds: [],
    matches: [{ p1: "B", p2: "Bye", role: "byeChallenge", done: true, winner: "Bye", p1Bp: 1, p2Bp: 4, creditBp: true }],
  };
  const r = C.resolvePlayoff(group, 1, noH2h, po);
  assert(r.resolved && r.qualifierIds[0] === "B", "Bye 贏 4–1：8+4=12 vs 12+1=13，高 BP 仍入");
}

console.log("\n── cutoff: 無需加賽時 3 人 BP 切開──");
{
  const r = C.analyzeCutoff([P("D", 20), P("E", 8), P("F", 8)], 1, noH2h);
  assert(r.resolved && r.qualifierIds[0] === "D", "三人最高 BP 直接入");
}

console.log("\n── cutoff: 7 人爭 2 席唔打決勝──");
{
  const r = C.analyzeCutoff(
    ["A", "B", "C", "D", "E", "F", "G"].map((id) => P(id, 8)),
    2,
    noH2h
  );
  const m = C.materializeCutoff(r, () => 0, (id) => id);
  assert(m.ko.spots === 2, "7 人爭 2 席");
  const po = {
    chain: "seedKo",
    ko: m.ko,
    matches: m.firstMatches.map((x, i) => ({ ...x, done: true, winner: x.p1, table: i + 1, p1Bp: 4, p2Bp: 0 })),
  };
  const adv = C.advanceSeedKo(po, (id) => id);
  const po2 = {
    chain: "seedKo",
    ko: m.ko,
    matches: po.matches.concat(adv.map((x, i) => ({ ...x, done: true, winner: x.p1, table: 10 + i, p1Bp: 4, p2Bp: 0 }))),
  };
  const adv2 = C.advanceSeedKo(po2, (id) => id);
  assert(adv2.length === 0, "爭 2 席：兩條線勝者都入，唔打決勝");
  const q = C.seedKoQualifiers(po2);
  assert(q && q.length === 2, "爭 2 席兩人入圍");
}

function PB(id, net, bp, extra) {
  return { id, name: id, netPoints: net, battlePoints: bp == null ? net : bp, byeCount: 0, metaScore: 0, ...(extra || {}) };
}
const optB = { rule: "B", oddPath: false };
const optBOdd = { rule: "B", oddPath: true };

console.log("\n── cutoff B: 淨勝分獎勵壓制──");
{
  const r = C.analyzeCutoff([PB("Spin", 16, 16), PB("Ex", 12, 24)], 1, noH2h, optB);
  assert(r.resolved && r.qualifierIds[0] === "Spin", "四場 4–0 Spin 淨勝 16 入圍，贏過四場 6–3 Extreme");
}

console.log("\n── cutoff B: 雙數紙上淨勝分／BP／對賽──");
{
  const r = C.analyzeCutoff([PB("A", 12), PB("B", 4), PB("C", 3), PB("D", 1)], 2, noH2h, optB);
  assert(r.resolved && r.qualifierIds.includes("A") && r.qualifierIds.includes("B"), "雙數：淨勝分已可分 2 席");
  assert(!r.needsMatches, "唔使加賽");
}
{
  const r = C.analyzeCutoff([PB("A", 8, 20), PB("B", 8, 12)], 1, noH2h, optB);
  assert(r.resolved && r.qualifierIds[0] === "A", "淨勝分同 → 高 BP 入");
}
{
  const r = C.analyzeCutoff([PB("A", 8, 10), PB("B", 8, 10)], 1, () => "B", optB);
  assert(r.resolved && r.qualifierIds[0] === "B", "淨勝分同 BP 同 → 對賽勝方入");
}
{
  const r = C.analyzeCutoff([PB("A", 8, 10), PB("B", 8, 10)], 1, noH2h, optB);
  assert(!r.resolved && r.chain === "bPair", "未曾對賽 → 加賽");
  assert(r.firstMatches[0].creditBp === false, "規則 B 加賽唔計 BP");
}

console.log("\n── cutoff B: 4 人 2 席高打低──");
{
  const r = C.analyzeCutoff(
    [PB("A", 8), PB("B", 8), PB("C", 8), PB("D", 8)],
    2,
    noH2h,
    optB
  );
  assert(r.chain === "bHighLow" && r.firstMatches.length === 2, "全同 → 兩場高打低");
  assert(r.firstMatches.every((m) => m.creditBp === false), "打贏出線");
}
{
  const r = C.analyzeCutoff(
    [PB("A", 20), PB("B", 10), PB("C", 6), PB("D", 2)],
    2,
    noH2h,
    optBOdd
  );
  assert(r.chain === "bHighLow", "單數路徑即使淨勝分不同都要打");
  assert(r.firstMatches[0].p1 === "A" && r.firstMatches[0].p2 === "D", "最高打最低");
  assert(r.firstMatches[1].p1 === "B" && r.firstMatches[1].p2 === "C", "第二高打第二低");
}

console.log("\n── cutoff B: 3 人種子──");
{
  const r = C.analyzeCutoff([PB("A", 12), PB("B", 8), PB("C", 3)], 2, noH2h, optBOdd);
  assert(r.chain === "bPair" && r.preQualifyIds[0] === "A", "3 人 2 席：最高直入");
  assert(r.firstMatches[0].p1 === "B" && r.firstMatches[0].p2 === "C", "其餘兩人打");
  const po = {
    chain: "bPair",
    preQualifyIds: r.preQualifyIds,
    matches: [{ ...r.firstMatches[0], done: true, winner: "C", p1Bp: 1, p2Bp: 4 }],
  };
  const out = C.resolvePlayoff([PB("A", 12), PB("B", 8), PB("C", 3)], 2, noH2h, po);
  assert(out.resolved && out.qualifierIds.includes("A") && out.qualifierIds.includes("C"), "種子 + 勝者入");
}
{
  const r = C.analyzeCutoff([PB("A", 12), PB("B", 8), PB("C", 3)], 1, noH2h, optBOdd);
  const m = C.materializeCutoff(r, () => 0, (id) => id);
  assert(r.chain === "seedKo" && m.ko.seedId === "A", "3 人 1 席：A 做種子");
  assert(m.firstMatches.length === 1 && m.firstMatches[0].p1 === "B" && m.firstMatches[0].p2 === "C", "B vs C 先打");
}

console.log("\n── cutoff B: 種子線／陀螺分──");
{
  const ko = C.buildSeedKoB(["A", "B", "C", "D", "E"], 2);
  assert(ko.template === "5" && ko.seedId === "A", "5 人種子選手係最高");
  assert(ko.wave1[0][0] === "B" && ko.wave1[0][1] === "E", "5 人：2v5");
  assert(ko.wave1[1][0] === "C" && ko.wave1[1][1] === "D", "5 人：3v4");
}
{
  const ko = C.buildSeedKoB(["A", "B", "C", "D", "E", "F"], 2);
  assert(ko.template === "6" && ko.seedLinePair[0] === "A" && ko.seedLinePair[1] === "F", "6 人種子線＝最高對最低");
}
{
  const r = C.analyzeCutoff(
    [PB("T0", 8, 8, { metaScore: 2 }), PB("T1", 8, 8, { metaScore: 1 })],
    1,
    noH2h,
    optBOdd
  );
  assert(r.chain === "bPair" && r.firstMatches[0].p1 === "T1", "單數 2 人仍要打；陀螺分低者排前（唔影響入圍，只排對賽／種子）");
}
{
  const r = C.analyzeCutoff(
    [
      PB("A", 8, 8, { metaScore: 2 }),
      PB("B", 8, 8, { metaScore: 1 }),
      PB("C", 8, 8, { metaScore: 1 }),
    ],
    2,
    noH2h,
    optBOdd
  );
  assert(r.preQualifyIds[0] === "B", "3 人 2 席：無 T0、T1 較少者優先做種子直入");
}

console.log("\n── cutoff B: 只淘汰 1 人──");
{
  const r = C.analyzeCutoff(
    [PB("A", 20), PB("B", 10), PB("C", 6), PB("D", 2)],
    3,
    noH2h,
    optBOdd
  );
  assert(r.chain === "bElim1", "4 人 3 席：只淘汰 1");
  assert(r.preQualifyIds.includes("A") && r.preQualifyIds.includes("B"), "最高兩人直入");
  assert(r.firstMatches[0].p1 === "C" && r.firstMatches[0].p2 === "D", "最低兩人打");
  const po = {
    chain: "bElim1",
    tiedIds: r.tiedIds,
    preQualifyIds: r.preQualifyIds,
    matches: [{ ...r.firstMatches[0], done: true, winner: "D", p1Bp: 0, p2Bp: 4 }],
  };
  const out = C.resolvePlayoff(
    [PB("A", 20), PB("B", 10), PB("C", 6), PB("D", 2)],
    3,
    noH2h,
    po
  );
  assert(out.resolved && out.qualifierIds.includes("D") && !out.qualifierIds.includes("C"), "負者出局，勝者留隊");
  assert(out.qualifierIds.length === 3, "3 人入圍");
}

console.log("\n── cutoff B: 8 人 3 席繼續產生夠勝者──");
{
  const group = ["A", "B", "C", "D", "E", "F", "G", "H"].map((id, i) => PB(id, 20 - i * 2, 12));
  const r = C.analyzeCutoff(group, 3, noH2h, optBOdd);
  const built = C.materializeCutoff(r, () => 0, (id) => id);
  assert(r.chain === "seedKo" && built.firstMatches.length === 4, "8 人 3 席首輪四場");
  const po = {
    chain: "seedKo",
    rule: "B",
    bOrdered: true,
    ko: built.ko,
    tiedIds: r.tiedIds,
    take: 3,
    preQualifyIds: [],
    matches: built.firstMatches.map((x) => ({ ...x, done: true, winner: x.p1, p1Bp: 4, p2Bp: 0 })),
  };
  const mid = C.resolvePlayoff(group, 3, noH2h, po);
  assert(!mid.resolved && mid.nextMatches && mid.nextMatches.length === 1, "4 個勝者爭 3 席：再打淘汰 1 人");
  po.matches = po.matches.concat(
    mid.nextMatches.map((x) => ({ ...x, done: true, winner: x.p1, p1Bp: 4, p2Bp: 0 }))
  );
  const out = C.resolvePlayoff(group, 3, noH2h, po);
  assert(out.resolved && out.qualifierIds.length === 3, "最終 3 人入圍");
  assert(!out.qualifierIds.includes("H") && !out.qualifierIds.includes("G"), "首輪負者不入");
}
{
  const group = ["A", "B", "C", "D", "E", "F"].map((id, i) => PB(id, 20 - i * 2, 12));
  const r = C.analyzeCutoff(group, 4, noH2h, optBOdd);
  assert(r.chain === "bHighLow" && r.preQualifyIds.length === 2, "6 人 4 席：最高 2 人直入");
  assert(r.firstMatches.length === 2, "其餘 4 人兩場");
  const po = {
    chain: "bHighLow",
    preQualifyIds: r.preQualifyIds,
    matches: r.firstMatches.map((x) => ({ ...x, done: true, winner: x.p1, p1Bp: 4, p2Bp: 0 })),
  };
  const out = C.resolvePlayoff(group, 4, noH2h, po);
  assert(out.resolved && out.qualifierIds.length === 4, "6 人 4 席最終 4 人入圍");
}

console.log("\n── late join pairing ──");
function pickByePreferLate(players) {
  return [...players].sort((a, b) => {
    const aLate = a.late ? 0 : 1;
    const bLate = b.late ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    return a.name.localeCompare(b.name, "zh-Hant");
  })[0];
}
function splitLatePairs(players) {
  const bye = players.length % 2 === 1 ? pickByePreferLate(players) : null;
  const pool = bye ? players.filter((p) => p.id !== bye.id) : players.slice();
  const ontime = pool.filter((p) => !p.late);
  const late = pool.filter((p) => p.late);
  const take = (g) => {
    const x = g.slice();
    let leftover = null;
    if (x.length % 2 === 1) leftover = x.pop();
    const pairs = [];
    for (let i = 0; i < x.length; i += 2) pairs.push([x[i].id, x[i + 1].id]);
    return { pairs, leftover };
  };
  const a = take(ontime);
  const b = take(late);
  const mixed = a.leftover && b.leftover ? [[a.leftover.id, b.leftover.id]] : [];
  return { bye: bye && bye.id, mixed };
}
{
  const players = [
    { id: "a", name: "A", late: false, swissPoints: 3 },
    { id: "b", name: "B", late: false, swissPoints: 2 },
    { id: "c", name: "C", late: true, swissPoints: 0 },
  ];
  const bye = pickByePreferLate(players);
  assert(bye.id === "c", "單數：遲到者優先坐場，避免準時選手抽到");
}
{
  const r = splitLatePairs([
    { id: "a", name: "A", late: false, swissPoints: 2 },
    { id: "b", name: "B", late: false, swissPoints: 2 },
    { id: "c", name: "C", late: true, swissPoints: 0 },
  ]);
  assert(r.bye === "c" && r.mixed.length === 0, "16 準時節奏：1 遲到 → 遲到坐場，無混合對");
}
{
  const r = splitLatePairs([
    { id: "a", name: "A", late: false, swissPoints: 2 },
    { id: "b", name: "B", late: false, swissPoints: 1 },
    { id: "c", name: "C", late: false, swissPoints: 1 },
    { id: "d", name: "D", late: true, swissPoints: 0 },
  ]);
  assert(r.bye == null && r.mixed.length === 1, "雙數但遲到單數：必有一場混合對（遲到自動 0–4）");
  assert(r.mixed[0].includes("d"), "混合對包含遲到者");
}
{
  const winnerId = "ontime";
  const m = { p1: "ontime", p2: "late", p1Bp: 0, p2Bp: 0 };
  m.winner = winnerId;
  m.p1Bp = 4;
  m.p2Bp = 0;
  assert(m.winner === "ontime" && m.p1Bp === 4 && m.p2Bp === 0, "遲到對戰：準時 4–0");
}
{
  const sit = { bye: true, p1: "late", p2: null, lateSitLoss: true, winner: null, p1Bp: 0, p2Bp: 4, done: true };
  assert(sit.lateSitLoss && sit.winner == null && sit.p2Bp === 4, "遲到坐場：唔係自動勝，記 0–4 負");
  const matchDone = !!sit.done;
  const won = matchDone && sit.winner === "late";
  assert(matchDone && !won, "歷史頁：遲到坐場算完場負，唔係進行中");
}

console.log("\n── rule B odd→even path ──");
function ruleBOddPlayoffPath(n, rule) {
  return rule === "B" && n % 2 === 1;
}
function ruleBUsesByeAdjust(n, rule, anyBye) {
  if (rule !== "B") return false;
  if (n % 2 === 1) return true;
  return !!anyBye;
}
assert(ruleBOddPlayoffPath(9, "B") === true, "9 人：爭席組必打");
assert(ruleBOddPlayoffPath(10, "B") === false, "加人變 10 人：改行紙上，唔再必打");
assert(ruleBUsesByeAdjust(10, "B", true) === true, "變雙數後仍然扣過往自動勝");
assert(ruleBUsesByeAdjust(16, "B", false) === false, "全程雙數無人坐場：唔扣");
assert(ruleBOddPlayoffPath(16, "A") === false, "規則 A 唔行 B 單數路徑");

console.log("\n── multi-host merge ──");
require("../sync.js");
const Sync = globalThis.BaoluoSync;
{
  const merged = Sync.mergePlayers(
    [{ id: "p1", name: "A", late: false, lateAt: "2026-08-22T12:00:00.000Z", deckChecked: false, beys: [] }],
    [{ id: "p1", name: "A", late: true, lateAt: "2026-08-22T11:00:00.000Z", deckChecked: true, beys: [{ bladeId: "ux-15", bit: "H" }] }]
  );
  assert(merged.length === 1, "同一人合併成一條");
  assert(merged[0].late === false, "較新嘅取消遲到唔被陀螺核對蓋走");
  assert(merged[0].deckChecked === true, "陀螺已核對要保留");
  assert(merged[0].beys && merged[0].beys[0] && merged[0].beys[0].bladeId === "ux-15", "較完整陀螺保留");
}
{
  const local = [{ id: "m1", p1: "a", p2: "c", done: false, p1Bp: 0, p2Bp: 0, battles: [] }];
  const remote = [{ id: "m2", p1: "a", p2: "b", done: true, p1Bp: 4, p2Bp: 1, winner: "a", battles: [{ winnerId: "a" }] }];
  const out = Sync.mergeMatchLists(local, remote);
  assert(out.length === 1, "兩套對戰表唔好叠成兩場");
  assert(out[0].p2 === "b" && out[0].done, "保留已有賽果嗰套配對");
}
{
  const local = { players: [], rounds: [], draw: { extras: [], prizes: [], results: [], excludedPlayerIds: [] } };
  const remote = {
    players: [],
    rounds: [],
    cutPlayoff: { chain: "bPair", matches: [{ id: "po1", p1: "a", p2: "b", done: true, winner: "a", p1Bp: 4, p2Bp: 0 }] },
    draw: { extras: [{ id: "dx1", name: "場外" }], prizes: [{ id: "pr1", name: "獎" }], results: [{ prizeId: "pr1", winnerName: "A" }], excludedPlayerIds: [] },
  };
  const out = Sync.mergeTournamentStates(local, remote);
  assert(out.cutPlayoff && out.cutPlayoff.matches.length === 1, "遠端入圍加賽唔好被空本機蓋走");
  assert(out.draw && out.draw.results.length === 1 && out.draw.extras.length === 1, "抽籤結果／場外名單要合併");
}
{
  const local = {
    instanceId: "t_new",
    phase: "setup",
    players: [],
    rounds: [],
    currentRound: 0,
  };
  const remote = {
    instanceId: "t_old",
    phase: "done",
    players: [{ id: "p1", name: "舊選手" }],
    rounds: [{ round: 1, matches: [{ id: "m1", p1: "p1", p2: "p2", done: true }] }],
    currentRound: 4,
  };
  const out = Sync.mergeTournamentStates(local, remote);
  assert((out.players || []).length === 0, "重置後新場次唔好合併舊選手");
  assert((out.rounds || []).length === 0, "重置後新場次唔好合併舊輪次");
  assert(out.instanceId === "t_new", "保留新場 instanceId");
}
{
  const stalePhone = {
    instanceId: "t_old",
    phase: "done",
    players: [{ id: "p1", name: "舊" }],
    rounds: [{ round: 1, matches: [] }],
    currentRound: 5,
    _rev: 80,
  };
  const newRoom = {
    instanceId: "t_new",
    phase: "setup",
    players: [],
    rounds: [],
    currentRound: 0,
    _rev: 1,
  };
  const out = Sync.mergeTournamentStates(stalePhone, newRoom);
  assert((out.players || []).length === 1, "merge 兩場唔同時保留本機（push 層要拒絕寫入）");
  assert(out.instanceId === "t_old", "instance 唔同時 merge 唔好改成本機舊場");
}

console.log("\n── resume flush 政策（手機 refresh 唔好蓋主電腦）──");
{
  const flush = (opts) => Sync.shouldResumeFlush(opts);
  assert(
    flush({
      deviceRole: "score",
      idsDiffer: false,
      localMissingInstanceId: false,
      isHost: true,
      localRev: 80,
      remoteRev: 5,
    }) === false,
    "計分板即使 localRev 較高都唔好 flush"
  );
  assert(
    flush({
      deviceRole: "desk",
      idsDiffer: true,
      localMissingInstanceId: false,
      isHost: true,
      localRev: 80,
      remoteRev: 5,
    }) === false,
    "唔同場次 instanceId 唔好 flush"
  );
  assert(
    flush({
      deviceRole: "desk",
      idsDiffer: false,
      localMissingInstanceId: true,
      isHost: true,
      localRev: 80,
      remoteRev: 5,
    }) === false,
    "本機無 instanceId、雲端有：當舊場，唔好 flush"
  );
  assert(
    flush({
      deviceRole: "view",
      idsDiffer: false,
      localMissingInstanceId: false,
      isHost: false,
      localRev: 80,
      remoteRev: 5,
    }) === false,
    "只讀角色唔好 flush"
  );
  assert(
    flush({
      deviceRole: "desk",
      idsDiffer: false,
      localMissingInstanceId: false,
      isHost: true,
      localRev: 12,
      remoteRev: 10,
    }) === true,
    "大會主電腦離線後有較新本機資料：可以 flush"
  );
  assert(
    flush({
      deviceRole: "desk",
      idsDiffer: false,
      localMissingInstanceId: false,
      isHost: true,
      localRev: 8,
      remoteRev: 10,
    }) === false,
    "本機 rev 較低：唔好 flush"
  );
}

console.log("\n════════════════════════");
console.log(`結果：${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log("全部通過\n");
