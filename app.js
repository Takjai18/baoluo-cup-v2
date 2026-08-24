/**
 * 寶螺盃 · 瑞士制管理系統
 * 可變人數（8–128，可單數）· 可調瑞士輪 · 先到 4 分 Match · localStorage
 * 淘汰賽可設 4／8／16 強（1 vs N、2 vs N-1 …）
 */

const STORAGE_KEY = "baoluo-cup-next";
const STORAGE_KEY_LEGACY = "baoluo-cup-next";
const BACKUP_KEY = "baoluo-cup-next-backups";
const BACKUP_MAX = 8;
const MATCH_TARGET = 4;
const PLAYER_PRESETS = [8, 16, 32, 64];
const KO_PRESETS = [4, 8, 16];
/** 報到區代號（最多 16 站） */
const ZONE_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

/** Beyblade X 官方 Finish → 得分 */
const FINISH_TYPES = {
  extreme: { id: "extreme", label: "Extreme Finish", short: "Extreme", pts: 3 },
  over: { id: "over", label: "Over Finish", short: "Over", pts: 2 },
  burst: { id: "burst", label: "Burst Finish", short: "Burst", pts: 2 },
  spin: { id: "spin", label: "Spin Finish", short: "Spin", pts: 1 },
  draw: { id: "draw", label: "平手", short: "平手", pts: 0 },
};

function finishPts(type) {
  return FINISH_TYPES[type]?.pts ?? 0;
}

function finishLabel(type) {
  return FINISH_TYPES[type]?.short || type || "?";
}

function emptyBattles() {
  return [];
}

function normalizeBattles(list) {
  if (!Array.isArray(list)) return emptyBattles();
  return list.map((b) => ({
    id: b.id || uid("b"),
    p1BeyIndex: b.p1BeyIndex === null || b.p1BeyIndex === undefined ? null : Number(b.p1BeyIndex),
    p2BeyIndex: b.p2BeyIndex === null || b.p2BeyIndex === undefined ? null : Number(b.p2BeyIndex),
    winnerId: b.finishType === "draw" ? null : b.winnerId || null,
    finishType: b.finishType || "spin",
    points:
      b.finishType === "draw"
        ? 0
        : Number.isFinite(Number(b.points))
          ? Number(b.points)
          : finishPts(b.finishType),
  }));
}

/** 由 battles 重算 Match BP 同勝方 */
function totalsFromBattles(p1Id, p2Id, battles) {
  let p1Bp = 0;
  let p2Bp = 0;
  for (const b of battles || []) {
    if (b.finishType === "draw" || !b.winnerId) continue;
    const pts = b.points || finishPts(b.finishType);
    if (b.winnerId === p1Id) p1Bp += pts;
    else if (b.winnerId === p2Id) p2Bp += pts;
  }
  const winnerId = autoWinnerFromScores(p1Id, p2Id, p1Bp, p2Bp);
  const a = Math.max(0, p1Bp);
  const b = Math.max(0, p2Bp);
  const draw = a >= MATCH_TARGET && b >= MATCH_TARGET && a === b;
  return { p1Bp, p2Bp, winnerId, done: !!winnerId || draw, draw };
}

function applyBattleTotals(m) {
  ensureMatchBeyOrders(m);
  if (!m.battles) m.battles = emptyBattles();
  else m.battles = normalizeBattles(m.battles);
  const t = totalsFromBattles(m.p1, m.p2, m.battles);
  m.p1Bp = t.p1Bp;
  m.p2Bp = t.p2Bp;
  if (t.done) {
    m.winner = t.winnerId || null;
    m.draw = !!t.draw && !t.winnerId;
    m.done = true;
  } else {
    m.winner = null;
    m.draw = false;
    m.done = false;
  }
  return m;
}

/**
 * 瑞士制輪數建議（依人數）
 * 經驗法則：約 ceil(log2(N))，並考慮重賽壓力（輪數接近 N-1 必重賽）
 */
function swissRoundsAdvice(playerCount) {
  const n = Math.max(2, playerCount | 0);
  const log2 = Math.log2(n);
  const optimal = Math.max(2, Math.min(n - 1, Math.ceil(log2)));
  // 合理區間：optimal±1，下限 2，上限 min(N-1, optimal+2)
  const minOk = Math.max(2, optimal - 1);
  const maxOk = Math.min(n - 1, Math.max(optimal + 1, minOk));
  const maxHard = Math.max(1, n - 1);
  // 重賽風險：每人可對 (n-1) 個不同對手；若 rounds > n/2 重賽壓力明顯上升
  const rematchRiskAt = Math.max(minOk, Math.floor(n / 2));
  return { n, optimal, minOk, maxOk, maxHard, rematchRiskAt, log2 };
}

function warnSwissRounds(playerCount, swissRounds, koSize) {
  const a = swissRoundsAdvice(playerCount);
  const r = swissRounds;
  const koN = getKoBracketSizeFor(playerCount, koSize);
  const msgs = [];
  if (r < a.minOk) {
    msgs.push({
      level: "warn",
      text: `輪數偏少（建議約 ${a.optimal} 輪，合理 ${a.minOk}–${a.maxOk}）。排名鑑別度可能不足，前 ${koN} 名邊界容易同分。`,
    });
  } else if (r > a.maxOk) {
    msgs.push({
      level: "warn",
      text: `輪數偏多（建議約 ${a.optimal} 輪，合理 ${a.minOk}–${a.maxOk}）。後期幾乎必然重賽，配對質素下降。`,
    });
  }
  if (r >= a.n - 1 && a.n > 2) {
    msgs.push({
      level: "danger",
      text: `輪數接近「每人幾乎對晒所有人」（最多 ${a.maxHard} 輪）。重賽無法避免。`,
    });
  } else if (r > a.rematchRiskAt) {
    msgs.push({
      level: "warn",
      text: `超過約 ${a.rematchRiskAt} 輪後，重賽機會會明顯上升（${a.n} 人場）。`,
    });
  }
  if (!msgs.length) {
    msgs.push({
      level: "ok",
      text: `瑞士輪數合適（建議 ${a.optimal} 輪 · 合理範圍 ${a.minOk}–${a.maxOk}）。`,
    });
  }
  if (a.n % 2 === 1) {
    msgs.push({
      level: "ok",
      text: `單數（${a.n} 人）每輪一人坐場。準時坐場＝自動獲勝 +1。已知會遲到者勾「遲到」：優先坐場但計 0–4 負；若對上準時選手亦自動 0–4。到達後取消勾選，之後輪次當準時（本輪已記嘅 0–4 保留）。平時坐場：未曾休息 → 勝場高 → 曾打過更高名次 → BP。僅最後一輪（準時選手）加：已穩入圍 → 已無希望入圍。`,
    });
  }
  return { advice: a, messages: msgs };
}

/** 淘汰規模：約場人數 ¼–½。單數剛過 16／32 時寧取大一檔，避免 4 強爭席加賽過長。 */
function koSizeAdvice(playerCount) {
  const n = Math.max(2, playerCount | 0);
  const allowed = KO_PRESETS.filter((k) => k <= n);
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

function warnKoSize(playerCount, koSize) {
  const a = koSizeAdvice(playerCount);
  const k = getKoBracketSizeFor(playerCount, koSize);
  const msgs = [];
  const ratio = a.n ? k / a.n : 1;
  if (k >= a.n) {
    msgs.push({
      level: "warn",
      text: `淘汰賽 ${k} 強等於或超過人數，瑞士制切唔到線。建議 ${a.optimal} 強。`,
    });
  } else if (k < a.optimal && a.n % 2 === 1 && a.n > 16) {
    msgs.push({
      level: "warn",
      text: `單數 ${a.n} 人用 ${k} 強，爭席加賽會偏長（例如 17 人 4 強成日 6 人爭 2 席打 4–5 場）。建議 ${a.optimal} 強。`,
    });
  } else if (k < a.optimal) {
    msgs.push({
      level: "warn",
      text: `淘汰名額偏少（建議 ${a.optimal} 強）。入圍邊界人多，加賽較長。`,
    });
  } else if (ratio >= 0.7) {
    msgs.push({
      level: "warn",
      text: `淘汰賽 ${k} 強佔 ${a.n} 人大部分，瑞士制幾乎人人入圍。建議 ${a.optimal} 強。`,
    });
  } else if (k === a.optimal) {
    msgs.push({
      level: "ok",
      text: `淘汰賽規模合適（建議 ${a.optimal} 強）。`,
    });
  } else {
    msgs.push({
      level: "ok",
      text: `淘汰賽 ${k} 強可用；建議值係 ${a.optimal} 強。`,
    });
  }
  return { advice: a, messages: msgs };
}

function warnEventFormat(playerCount, swissRounds, koSize) {
  const swiss = warnSwissRounds(playerCount, swissRounds, koSize);
  const ko = warnKoSize(playerCount, koSize);
  return { swiss: swiss.advice, ko: ko.advice, messages: swiss.messages.concat(ko.messages) };
}

function defaultKoSize(playerCount) {
  return koSizeAdvice(playerCount).optimal;
}

function getKoBracketSizeFor(playerCount, koSize) {
  let k = parseInt(koSize, 10);
  if (!Number.isFinite(k) || !KO_PRESETS.includes(k)) k = defaultKoSize(playerCount);
  // 不可超過參賽人數；向下取最大合法 4/8/16
  while (k > playerCount && k > 2) k = k / 2;
  if (k < 2) k = 2;
  if (!KO_PRESETS.includes(k) && k !== 2) {
    k = KO_PRESETS.filter((x) => x <= playerCount).pop() || 2;
  }
  return k;
}

const QUALIFY_RULES = ["A", "B"];
const QUALIFY_RULE_ENGINE_READY = { A: true, B: true };

function defaultSettings() {
  return {
    referees: 4, // 裁判人數
    stadiums: 4, // 對戰盤數量（建議 2–4）
    swissRounds: 4, // 瑞士制輪次
    playerCount: 16, // 參賽人數（可單數；單數則輪空）
    playerPreset: "16", // '8' | '16' | '32' | '64' | 'other'
    koSize: 4, // 淘汰賽名額：4 | 8 | 16
    qualifyRule: "A", // 入圍規則 A 完整決策樹／B 簡易（淨勝分、打贏出線）
  };
}

function normalizeSettings(s) {
  const d = defaultSettings();
  const src = s && typeof s === "object" ? s : {};
  let referees = parseInt(src.referees, 10);
  let stadiums = parseInt(src.stadiums, 10);
  let swissRounds = parseInt(src.swissRounds, 10);
  let playerCount = parseInt(src.playerCount, 10);
  let playerPreset = String(src.playerPreset || "");
  let koSize = parseInt(src.koSize, 10);
  let qualifyRule = String(src.qualifyRule || d.qualifyRule || "A")
    .trim()
    .toUpperCase();
  if (!QUALIFY_RULES.includes(qualifyRule)) qualifyRule = d.qualifyRule;

  if (!Number.isFinite(referees) || referees < 1) referees = d.referees;
  if (!Number.isFinite(stadiums) || stadiums < 1) stadiums = d.stadiums;
  if (!Number.isFinite(swissRounds) || swissRounds < 1) swissRounds = d.swissRounds;
  if (!Number.isFinite(playerCount) || playerCount < 2) playerCount = d.playerCount;

  referees = Math.min(16, Math.max(1, referees));
  stadiums = Math.min(16, Math.max(1, stadiums));
  swissRounds = Math.min(12, Math.max(1, swissRounds));
  // 人數可單可雙；單數瑞士制該輪一人輪空
  playerCount = Math.min(128, Math.max(2, Math.round(playerCount)));

  if (PLAYER_PRESETS.includes(playerCount) && (!playerPreset || playerPreset === "other")) {
    playerPreset = String(playerCount);
  }
  if (!playerPreset) {
    playerPreset = PLAYER_PRESETS.includes(playerCount) ? String(playerCount) : "other";
  }
  if (playerPreset !== "other" && PLAYER_PRESETS.includes(Number(playerPreset))) {
    playerCount = Number(playerPreset);
  } else {
    playerPreset = "other";
  }

  if (!Number.isFinite(koSize)) koSize = defaultKoSize(playerCount);
  koSize = getKoBracketSizeFor(playerCount, koSize);

  return { referees, stadiums, swissRounds, playerCount, playerPreset, koSize, qualifyRule };
}

/** 實際可用報到站 = min(裁判, 對戰盤) */
function getActiveStations() {
  const s = normalizeSettings(state.settings);
  return Math.max(1, Math.min(s.referees, s.stadiums));
}

function getSwissRounds() {
  return normalizeSettings(state.settings).swissRounds;
}

/** 設定中嘅目標人數（可單數） */
function getTotalPlayers() {
  return normalizeSettings(state.settings).playerCount;
}

/** 實際配對用人數：開賽後跟名單 */
function getPairingPlayerCount() {
  if (state.phase !== "setup" && state.players.length >= 2) return state.players.length;
  return getTotalPlayers();
}

/** 淘汰賽名額（4／8／16） */
function getKoBracketSize() {
  const s = normalizeSettings(state.settings);
  return getKoBracketSizeFor(s.playerCount, s.koSize);
}

function getQualifyRule() {
  const r = String(normalizeSettings(state.settings).qualifyRule || "A").toUpperCase();
  return QUALIFY_RULES.includes(r) ? r : "A";
}

function qualifyRuleLabel(rule) {
  return rule === "B" ? "規則 B（簡易規則）" : "規則 A（完整決策樹）";
}

function qualifyEngineReady(rule) {
  return !!QUALIFY_RULE_ENGINE_READY[rule || getQualifyRule()];
}

/** 產生入圍／淘汰賽前：規則 B 未實作則請改用 A */
function ensureQualifyEngineForAction(actionLabel) {
  const rule = getQualifyRule();
  if (qualifyEngineReady(rule)) return true;
  if (
    confirm(
      `${qualifyRuleLabel(rule)}尚未寫入系統。\n要改用規則 A 嚟${actionLabel}？`
    )
  ) {
    state.settings = normalizeSettings({ ...state.settings, qualifyRule: "A" });
    saveState({ backup: "改用入圍規則 A" });
    return true;
  }
  toast(`${qualifyRuleLabel(rule)}尚未寫入系統。請喺大會設定改用規則 A。`, "error");
  return false;
}

function updateQualifyRuleHint(rule) {
  const hint = document.getElementById("qualifyRuleHint");
  if (!hint) return;
  if (rule === "B") {
    hint.innerHTML =
      "規則 B 為簡易入圍：獎勵壓制（淨勝分）。而家係雙數就先睇紙上（淨勝分 → 總 BP → 對賽）；而家係單數就扣坐場分後爭席組打贏出線。單數開場之後加人變成雙數：仍然扣過往自動勝再切線，但改行紙上（唔再逼爭席組必打）。詳情見「規則」頁。";
  } else {
    hint.innerHTML =
      "規則 A 為完整入圍決策樹（坐場、BP、對賽、加賽多數打贏≠入圍）。詳情見「規則」頁。";
  }
}

function deckMetaScore(player) {
  if (!player || typeof getBeyTier !== "function") return 0;
  let s = 0;
  for (const b of player.beys || []) {
    const t = getBeyTier(b);
    if (t === "T0") s += 2;
    else if (t === "T1") s += 1;
  }
  return s;
}

function ruleBUsesByeAdjust() {
  if (getQualifyRule() !== "B") return false;
  if (getPairingPlayerCount() % 2 === 1) return true;
  return state.players.some((p) => byeCount(p.id) > 0);
}

/** 規則 B 第 3 層「爭席組必打」只跟而家人數係單定雙，唔跟開場時係單數。 */
function ruleBOddPlayoffPath() {
  return getQualifyRule() === "B" && getPairingPlayerCount() % 2 === 1;
}

function getMatchesPerRound() {
  return Math.floor(getPairingPlayerCount() / 2);
}

function zoneCode(zoneIndex) {
  return ZONE_CODES[zoneIndex] || String(zoneIndex + 1);
}

function zoneLabel(zoneIndex) {
  return `${zoneCode(zoneIndex)} 區`;
}

/** 將本輪各場分配到 A/B/C… 區（round-robin） */
function assignMatchZones(matches) {
  const n = getActiveStations();
  return matches.map((m, i) => {
    const zone = i % n;
    return {
      ...m,
      table: i + 1,
      zone,
      zoneCode: zoneCode(zone),
      zoneLabel: zoneLabel(zone),
    };
  });
}

const CHURCH = {
  kcc: { id: "kcc", short: "城基", full: "九龍城基督徒會" },
  ky: { id: "ky", short: "基蔭", full: "宣道會基蔭堂" },
};

const DEMO_PLAYERS = [
  ["陳大文", "kcc"], ["李小明", "kcc"], ["王志強", "kcc"], ["張美玲", "kcc"],
  ["劉偉傑", "kcc"], ["黃嘉欣", "kcc"], ["周子豪", "kcc"], ["吳詠詩", "kcc"],
  ["林俊傑", "ky"], ["何家輝", "ky"], ["鄭雅婷", "ky"], ["謝志明", "ky"],
  ["馬啟聰", "ky"], ["楊曉彤", "ky"], ["羅偉業", "ky"], ["許心怡", "ky"],
];

/** Demo decks for event-day practice (complete 3 beys) */
const DEMO_DECKS = [
  [
    { bladeId: "bx-01", ratchet: "3-60", bit: "J" },
    { bladeId: "bx-23", ratchet: "9-60", bit: "H" },
    { bladeId: "bx-21", ratchet: "5-70", bit: "T" },
  ],
  [
    { bladeId: "ux-03", ratchet: "1-60", bit: "B" },
    { bladeId: "ux-01", ratchet: "4-80", bit: "P" },
    { bladeId: "bx-04", ratchet: "9-80", bit: "F" },
  ],
];

function demoBeyFromTemplate(t) {
  const bey = emptyBey();
  const blade = findBladeById(t.bladeId);
  if (blade) applyBladeToBey(bey, blade);
  bey.ratchet = t.ratchet;
  bey.bit = t.bit;
  return bey;
}

// ─── State ───────────────────────────────────────────────
function defaultState() {
  return {
    // players: { id, name, church, beys[3], deckChecked }
    players: [],
    settings: defaultSettings(),
    phase: "setup", // setup | swiss | knockout | done
    currentRound: 0, // 1..N when swiss
    rounds: [], // { round, locked, matches: [{ id, p1, p2, zone, zoneLabel, winner, p1Bp, p2Bp, done }] }
    knockout: null, // { bracketSize, rounds:[{name,matches}], third, final }
    cutPlayoff: null, // 入圍加賽 { spots, cutScore, playerIds, matches, chain, highId }
    draw: defaultDraw(),
    instanceId: null,
    updatedAt: null,
    _rev: 0,
  };
}

function newTournamentInstanceId() {
  return uid("t");
}

function defaultDraw() {
  return {
    extras: [],
    excludedPlayerIds: [],
    prizes: [],
    results: [],
  };
}

function normalizeDraw(d) {
  const base = defaultDraw();
  if (!d || typeof d !== "object") return base;
  const extras = Array.isArray(d.extras)
    ? d.extras
        .map((e) => ({
          id: String(e.id || uid("dx")),
          name: String(e.name || "").trim(),
          church: ["kcc", "ky", "out"].includes(e.church) ? e.church : "out",
        }))
        .filter((e) => e.name)
    : [];
  const prizes = Array.isArray(d.prizes)
    ? d.prizes
        .map((p) => ({
          id: String(p.id || uid("prize")),
          name: String(p.name || "").trim(),
        }))
        .filter((p) => p.name)
    : [];
  const results = Array.isArray(d.results)
    ? d.results.map((r) => ({
        prizeId: String(r.prizeId || ""),
        prizeName: String(r.prizeName || ""),
        winnerKey: String(r.winnerKey || ""),
        winnerName: String(r.winnerName || ""),
        church: r.church || "",
        at: r.at || null,
      }))
    : [];
  const excludedPlayerIds = Array.isArray(d.excludedPlayerIds)
    ? d.excludedPlayerIds.map(String)
    : [];
  return { extras, prizes, results, excludedPlayerIds };
}

function ensureDraw() {
  state.draw = normalizeDraw(state.draw);
  return state.draw;
}

function migratePlayers(players) {
  return (players || []).map((p) => normalizePlayer({ ...p }));
}

/** 舊淘汰賽 { semis } → { rounds, bracketSize } */
function migrateKnockout(ko) {
  if (!ko) return null;
  if (Array.isArray(ko.rounds) && ko.rounds.length) {
    return {
      bracketSize: ko.bracketSize || (ko.rounds[0].matches?.length || 1) * 2,
      rounds: ko.rounds,
      third: ko.third || null,
      final: ko.final || null,
      _advancedFrom: ko._advancedFrom || {},
    };
  }
  if (Array.isArray(ko.semis) && ko.semis.length) {
    return {
      bracketSize: ko.semis.length * 2,
      rounds: [{ name: koRoundLabel(ko.semis.length * 2), matches: ko.semis }],
      third: ko.third || null,
      final: ko.final || null,
      _advancedFrom: {},
    };
  }
  return ko;
}

function koRoundLabel(playersInRound) {
  if (playersInRound >= 16) return "十六強";
  if (playersInRound >= 8) return "八強";
  if (playersInRound >= 4) return "準決賽";
  return "決賽圈";
}

let state = loadState();

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY_LEGACY);
    }
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const st = { ...defaultState(), ...parsed };
    st.settings = normalizeSettings(parsed.settings || st.settings);
    st.players = migratePlayers(st.players);
    st.knockout = migrateKnockout(parsed.knockout || st.knockout);
    st.draw = normalizeDraw(parsed.draw || st.draw);
    st.instanceId = parsed.instanceId || null;
    st._rev = parseInt(parsed._rev, 10) || 0;
    // 補上舊場次 zone（若無）
    const stations = Math.max(1, Math.min(st.settings.referees, st.settings.stadiums));
    st.rounds = (st.rounds || []).map((r) => ({
      ...r,
      matches: (r.matches || []).map((m, i) => {
        if (m.zone != null && m.zoneCode) return m;
        const zone = i % stations;
        return {
          ...m,
          zone,
          zoneCode: ZONE_CODES[zone] || String(zone + 1),
          zoneLabel: `${ZONE_CODES[zone] || zone + 1} 區`,
        };
      }),
    }));
    return st;
  } catch {
    return defaultState();
  }
}

function saveState(opts = {}) {
  // 雲端只讀：唔准本機寫入／推送（遠端套用走 fromRemote）
  if (!opts.fromRemote && window.BaoluoSync?.isReadOnly?.()) {
    toast("而家係只讀模式（未輸入主持碼），無法改資料", "error");
    // 丟棄誤改，還原上次已同步／已存本機版本
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const st = { ...defaultState(), ...parsed };
        st.settings = normalizeSettings(st.settings || {});
        st.players = migratePlayers(st.players);
        st.knockout = migrateKnockout(st.knockout);
        st.draw = normalizeDraw(st.draw);
        state = st;
      }
    } catch (_) {
      /* ignore */
    }
    render();
    return false;
  }

  if (!opts.fromRemote) {
    state.updatedAt = new Date().toISOString();
    state._rev = (state._rev || 0) + 1;
  } else if (opts.remoteRev != null) {
    state._rev = parseInt(opts.remoteRev, 10) || state._rev || 0;
    state.updatedAt = opts.remoteUpdatedAt || state.updatedAt || new Date().toISOString();
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY + "-rev", String(state._rev));
    const el = document.getElementById("saveTime");
    if (el) {
      el.textContent =
        (opts.fromRemote ? "已同步 " : "已儲存 ") + new Date().toLocaleTimeString("zh-HK");
    }
    if (opts.backup) pushAutoBackup(opts.backup);
    if (!opts.fromRemote && window.BaoluoSync?.isHost?.()) {
      window.BaoluoSync.schedulePush(state);
    }
    return true;
  } catch (e) {
    console.error(e);
    toast("儲存失敗（本機空間或隱私模式？）：" + (e.message || e), "error");
    return false;
  }
}

/** 雲端只讀時攔截寫入；回傳 true = 可以繼續 */
function assertCanWrite() {
  if (window.BaoluoSync?.isReadOnly?.()) {
    toast("只讀模式：請用主持碼加入先可以改分", "error");
    return false;
  }
  return true;
}

function hydrateTournamentState(parsed) {
  const st = { ...defaultState(), ...parsed };
  st.settings = normalizeSettings(st.settings || {});
  st.players = migratePlayers(st.players);
  st.knockout = migrateKnockout(st.knockout);
  st.draw = normalizeDraw(st.draw);
  st.instanceId = parsed.instanceId || st.instanceId || null;
  return st;
}

function isFreshTournamentState(st) {
  const s = st || state;
  return (
    (!s.players || s.players.length === 0) &&
    (!s.rounds || s.rounds.length === 0) &&
    !s.knockout &&
    (s.phase === "setup" || !s.phase)
  );
}

function abandonCloudRoom() {
  const sync = window.BaoluoSync;
  if (!sync?.getRoomId?.()) return;
  sync.leaveRoom();
}

function applyRemoteTournamentState(payload, opts = {}) {
  if (!payload || !payload.state) return;
  const remoteRev = parseInt(payload.rev, 10) || 0;
  const localRev = parseInt(state._rev, 10) || 0;
  const role = window.BaoluoSync?.getStatus?.()?.role || "viewer";
  const justPushed = window.BaoluoSync?.getStatus?.()?.lastPushedRev || 0;
  const pendingPush = !!window.BaoluoSync?.getStatus?.()?.pendingPush;
  const apply = opts.force || payload.merged
    ? true
    : window.BaoluoSync?.shouldApplyRemote
      ? window.BaoluoSync.shouldApplyRemote(localRev, remoteRev, role, justPushed)
      : remoteRev > localRev;
  if (!apply) return;

  const parsed = payload.state;
  if (
    !opts.force &&
    state.instanceId &&
    parsed.instanceId &&
    state.instanceId !== parsed.instanceId
  ) {
    return;
  }
  const pendingLocal =
    role === "host" &&
    !opts.force &&
    !payload.merged &&
    typeof window.BaoluoSync?.mergeTournamentStates === "function" &&
    (pendingPush || localRev > justPushed);

  let st;
  if (pendingLocal) {
    // 多部主持同時入分：遠端快照唔可以整份蓋走尚未推送嘅本機賽果。
    // 合併進同一個 state 物件，等已排程嘅 schedulePush 仍然推到合併後資料。
    const merged = window.BaoluoSync.mergeTournamentStates(state, parsed);
    st = hydrateTournamentState(merged);
    Object.keys(state).forEach((k) => {
      if (!(k in st)) delete state[k];
    });
    Object.assign(state, st);
  } else {
    st = hydrateTournamentState(parsed);
    state = st;
  }
  saveState({
    fromRemote: true,
    remoteRev: pendingLocal ? Math.max(localRev, remoteRev) : remoteRev,
    remoteUpdatedAt: payload.updatedAt || null,
  });
  render();
  updateSyncUi();
}

/** 滾動自動備份（最多 BACKUP_MAX 份） */
function pushAutoBackup(label) {
  try {
    const snap = JSON.parse(JSON.stringify(state));
    // 備份可保留完整資料以便還原
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }
    list.unshift({
      id: "bk_" + Date.now().toString(36),
      ts: Date.now(),
      label: label || "自動備份",
      phase: state.phase,
      playerCount: state.players?.length || 0,
      data: snap,
    });
    while (list.length > BACKUP_MAX) list.pop();
    localStorage.setItem(BACKUP_KEY, JSON.stringify(list));
    renderBackupPanel?.();
  } catch (e) {
    console.warn("backup failed", e);
  }
}

function listBackups() {
  try {
    const list = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function restoreBackupById(id) {
  const item = listBackups().find((b) => b.id === id);
  if (!item?.data) {
    toast("搵唔到該備份", "error");
    return false;
  }
  if (!confirm(`還原備份「${item.label}」（${new Date(item.ts).toLocaleString("zh-HK")}）？\n會覆蓋目前資料。`)) {
    return false;
  }
  const data = item.data;
  state = { ...defaultState(), ...data };
  state.settings = normalizeSettings(data.settings || state.settings);
  state.players = migratePlayers(data.players);
  state.knockout = migrateKnockout(data.knockout);
  state.draw = normalizeDraw(data.draw);
  saveState();
  render();
  toast("已還原備份", "success");
  return true;
}

/** 匯出用：可剔除出場次序（私隱） */
function stateForExport(opts = {}) {
  const hideOrder = !!opts.hideBeyOrder;
  const clone = JSON.parse(JSON.stringify(state));
  if (!hideOrder) return clone;
  const stripMatch = (m) => {
    if (!m) return m;
    delete m.p1BeyOrder;
    delete m.p2BeyOrder;
    if (Array.isArray(m.battles)) {
      m.battles = m.battles.map((b) => {
        const x = { ...b };
        // 保留 finish／勝方；可選隱藏 bey index
        return x;
      });
    }
    return m;
  };
  clone.rounds = (clone.rounds || []).map((r) => ({
    ...r,
    matches: (r.matches || []).map(stripMatch),
  }));
  if (clone.knockout) {
    clone.knockout.rounds = (clone.knockout.rounds || []).map((r) => ({
      ...r,
      matches: (r.matches || []).map(stripMatch),
    }));
    clone.knockout.third = stripMatch(clone.knockout.third);
    clone.knockout.final = stripMatch(clone.knockout.final);
    if (clone.knockout.semis) clone.knockout.semis = clone.knockout.semis.map(stripMatch);
  }
  clone._exportNote = "已隱藏出場次序（p1BeyOrder / p2BeyOrder）";
  return clone;
}

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast " + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
}

function churchLabel(id) {
  return CHURCH[id]?.short || id;
}

function churchFull(id) {
  return CHURCH[id]?.full || id;
}

function playerById(id) {
  return state.players.find((p) => p.id === id);
}

function parseChurch(s) {
  const t = String(s || "").trim().toLowerCase();
  if (["kcc", "城基", "九龍城", "九龍城基督徒會", "kowloon", "kc"].includes(t)) return "kcc";
  if (["ky", "基蔭", "宣道會基蔭堂", "kei yam", "keiyam", "基蔭堂"].includes(t)) return "ky";
  if (t.includes("城基") || t.includes("九龍") || t.includes("kcc")) return "kcc";
  if (t.includes("基蔭") || t.includes("ky") || t.includes("宣道")) return "ky";
  return null;
}

// ─── Stats & Ranking ─────────────────────────────────────
function iterKnockoutMatches() {
  if (!state.knockout) return [];
  const list = [];
  if (Array.isArray(state.knockout.rounds)) {
    for (const r of state.knockout.rounds) {
      for (const m of r.matches || []) list.push(m);
    }
  }
  if (Array.isArray(state.knockout.semis)) {
    for (const m of state.knockout.semis) list.push(m);
  }
  if (state.knockout.third) list.push(state.knockout.third);
  if (state.knockout.final) list.push(state.knockout.final);
  return list;
}

function allCompletedMatches() {
  const list = [];
  for (const r of state.rounds) {
    for (const m of r.matches) {
      if (m.done && m.winner) list.push({ ...m, round: r.round });
    }
  }
  for (const m of iterKnockoutMatches()) {
    if (m.done && m.winner) list.push({ ...m, round: "KO" });
  }
  return list;
}

function swissMatchesOnly() {
  const list = [];
  for (const r of state.rounds) {
    for (const m of r.matches) {
      if (m.done) list.push({ ...m, round: r.round });
    }
  }
  return list;
}

function getPlayerStats(playerId) {
  let wins = 0, losses = 0, battlePoints = 0, netPoints = 0, byes = 0;
  const opponents = [];
  /** 每局詳情：{ round, oppId, won, myBp, oppBp } */
  const matchLog = [];
  for (const m of swissMatchesOnly()) {
    if (m.p1 !== playerId && m.p2 !== playerId) continue;
    if (isByeMatch(m)) {
      if (m.lateSitLoss) {
        if (m.p1 === playerId) {
          losses++;
          netPoints -= MATCH_TARGET;
          matchLog.push({
            round: m.round,
            oppId: null,
            won: false,
            draw: false,
            myBp: 0,
            oppBp: MATCH_TARGET,
          });
        }
        continue;
      }
      if (m.winner === playerId) {
        wins++;
        byes++;
      }
      continue;
    }
    const isP1 = m.p1 === playerId;
    const myBp = isP1 ? m.p1Bp : m.p2Bp;
    const oppBp = isP1 ? m.p2Bp : m.p1Bp;
    const oppId = isP1 ? m.p2 : m.p1;
    const won = m.winner === playerId;
    const draw = !m.winner || !!m.draw;
    battlePoints += myBp || 0;
    netPoints += (myBp || 0) - (oppBp || 0);
    opponents.push(oppId);
    matchLog.push({
      round: m.round,
      oppId,
      won,
      draw,
      myBp: myBp || 0,
      oppBp: oppBp || 0,
    });
    if (won) wins++;
    else if (m.winner) losses++;
  }
  return {
    wins,
    losses,
    battlePoints,
    netPoints,
    byeCount: byes,
    adjustedSwiss: wins - byes,
    opponents,
    matchLog,
    swissPoints: wins,
  };
}

function isByeMatch(m) {
  return !!(m && (m.bye || !m.p2));
}

function headToHead(aId, bId) {
  let last = null;
  for (const m of swissMatchesOnly()) {
    if (isByeMatch(m)) continue;
    if ((m.p1 === aId && m.p2 === bId) || (m.p1 === bId && m.p2 === aId)) {
      last = m.winner || null;
    }
  }
  return last;
}

function havePlayed(aId, bId) {
  return headToHead(aId, bId) !== null ||
    state.rounds.some((r) =>
      r.matches.some((m) =>
        (m.p1 === aId && m.p2 === bId) || (m.p1 === bId && m.p2 === aId)
      )
    );
}

function lastRoundOpponent(playerId) {
  if (!state.rounds.length) return null;
  const last = state.rounds[state.rounds.length - 1];
  // if current round not locked, "last" for pairing of new round is previous locked
  const locked = state.rounds.filter((r) => r.locked);
  const prev = locked[locked.length - 1];
  if (!prev) return null;
  const m = prev.matches.find((x) => x.p1 === playerId || x.p2 === playerId);
  if (!m) return null;
  return m.p1 === playerId ? m.p2 : m.p1;
}

/**
 * Rank players for standings.
 * 1. 瑞士積分（勝場）
 * 2. 同一瑞士分組：
 *    - 剛好 2 人且曾對賽 → Head-to-Head
 *    - 3 人以上（多角同分）→ 只用 BP，避免 pairwise H2H 循環／不穩定
 * 3. 比賽總分 BP
 * 4. 姓名
 */
function rankedPlayers() {
  const rows = state.players.map((p) => {
    const s = getPlayerStats(p.id);
    return { ...p, ...s };
  });

  // 按瑞士分組，組內穩定排序（避免多角 H2H 破壞）
  const bySwiss = new Map();
  for (const r of rows) {
    const key = r.swissPoints;
    if (!bySwiss.has(key)) bySwiss.set(key, []);
    bySwiss.get(key).push(r);
  }
  const swissKeys = [...bySwiss.keys()].sort((a, b) => b - a);
  const ordered = [];
  for (const sp of swissKeys) {
    const g = bySwiss.get(sp);
    g.sort((a, b) => {
      if (g.length === 2) {
        const h2h = headToHead(a.id, b.id);
        if (h2h === a.id) return -1;
        if (h2h === b.id) return 1;
      }
      if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
      return a.name.localeCompare(b.name, "zh-Hant");
    });
    ordered.push(...g);
  }

  for (let i = 0; i < ordered.length; i++) {
    if (i === 0) {
      ordered[i].rank = 1;
      ordered[i].tied = false;
      continue;
    }
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const sameSwiss = prev.swissPoints === cur.swissPoints;
    const sameBp = prev.battlePoints === cur.battlePoints;
    let h2hDecides = false;
    if (sameSwiss && sameBp) {
      // 僅當二人組且 H2H 已分出高下時不視為同分並列
      const group = ordered.filter((x) => x.swissPoints === cur.swissPoints);
      if (group.length === 2) {
        const h2h = headToHead(prev.id, cur.id);
        h2hDecides = h2h === prev.id || h2h === cur.id;
      }
    }
    if (sameSwiss && sameBp && !h2hDecides) {
      ordered[i].rank = prev.rank;
      ordered[i].tied = true;
      prev.tied = true;
    } else {
      ordered[i].rank = i + 1;
      ordered[i].tied = false;
    }
  }
  return ordered;
}

function needsPlayoffBetween(a, b) {
  if (a.swissPoints !== b.swissPoints) return false;
  // 二人且有 H2H → 已分高下
  const h2h = headToHead(a.id, b.id);
  if (h2h) return false;
  if (a.battlePoints !== b.battlePoints) return false;
  return true;
}

function hasAutoWin(playerId) {
  return byeCount(playerId) > 0;
}

function shuffleList(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cutoffScoreOf(p, byeAdjust) {
  if (!byeAdjust) return p.swissPoints;
  const byes = p.byeCount != null ? p.byeCount : byeCount(p.id);
  return (p.swissPoints || 0) - (byes || 0);
}

/** 爭最後幾個淘汰賽名額的同分組 */
function getCutoffContext() {
  const koN = getKoBracketSize();
  const ranked = rankedPlayers();
  if (!ranked.length || ranked.length < koN) {
    return { needed: false, resolved: true, koN, ranked };
  }
  const byeAdjust = ruleBUsesByeAdjust();
  const ordered = byeAdjust
    ? [...ranked].sort((a, b) => cutoffScoreOf(b, true) - cutoffScoreOf(a, true))
    : ranked;
  const cutScore = cutoffScoreOf(ordered[koN - 1], byeAdjust);
  const lockedIn = ranked.filter((p) => cutoffScoreOf(p, byeAdjust) > cutScore);
  const group = ranked.filter((p) => cutoffScoreOf(p, byeAdjust) === cutScore);
  const spots = koN - lockedIn.length;
  const oddPath = ruleBOddPlayoffPath();
  if (spots <= 0 || group.length <= spots) {
    return { needed: false, resolved: true, koN, ranked, lockedIn, group, spots, cutScore, oddPath, byeAdjust };
  }
  return { needed: true, resolved: false, koN, ranked, lockedIn, group, spots, cutScore, oddPath, byeAdjust };
}

function makePlayoffMatch(p1Id, p2Id, label) {
  return {
    id: uid("po"),
    table: 0,
    label: label || "入圍加賽",
    p1: p1Id,
    p2: p2Id,
    winner: null,
    p1Bp: 0,
    p2Bp: 0,
    done: false,
    draw: false,
    p1BeyOrder: emptyBeyOrder(),
    p2BeyOrder: emptyBeyOrder(),
    battles: emptyBattles(),
    playoff: true,
    creditBp: true,
    role: "pair",
  };
}

function decorateCutoffGroup(group) {
  return (group || []).map((p) => {
    const full = playerById(p.id) || p;
    return {
      id: p.id,
      name: p.name,
      battlePoints: p.battlePoints,
      netPoints: p.netPoints || 0,
      swissPoints: p.swissPoints,
      byeCount: p.byeCount != null ? p.byeCount : byeCount(p.id),
      metaScore: deckMetaScore(full),
    };
  });
}

function analyzeLiveCutoff(ctx) {
  if (!ctx?.needed) {
    return {
      resolved: true,
      qualifierIds: (ctx?.group || []).map((p) => p.id),
      lines: [],
      needsMatches: false,
      chain: null,
    };
  }
  return BaoluoCutoff.analyzeCutoff(decorateCutoffGroup(ctx.group), ctx.spots, headToHead, {
    rule: getQualifyRule(),
    oddPath: !!ctx.oddPath,
  });
}

function sortCutoffPlayers(a, b) {
  if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
  const h = headToHead(a.id, b.id);
  if (h === a.id) return -1;
  if (h === b.id) return 1;
  return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
}

function describeCutoffPlan(ctx) {
  const a = analyzeLiveCutoff(ctx);
  return {
    lines: a.lines || [],
    firstPairs: (a.firstMatches || []).map((m) => [m.p1, m.p2]),
    chain: a.chain || null,
    highId: null,
    preQualifyIds: a.preQualifyIds || [],
    tiedIds: a.tiedIds || [],
    resolved: !!a.resolved,
    needsMatches: !!a.needsMatches,
    qualifierIds: a.qualifierIds || [],
  };
}

function playoffDescriptorKey(d) {
  return `${d.wave || 1}|${[d.p1, d.p2].sort().join("|")}|${d.role || ""}`;
}

function appendPlayoffMatches(po, descriptors) {
  if (!po || !descriptors?.length) return;
  const existing = new Set((po.matches || []).map((m) => playoffDescriptorKey(m)));
  descriptors.forEach((d) => {
    const key = playoffDescriptorKey(d);
    if (existing.has(key)) return;
    existing.add(key);
    const m = makePlayoffMatch(d.p1, d.p2, d.label);
    m.wave = d.wave || 1;
    m.table = po.matches.length + 1;
    m.creditBp = d.creditBp !== false;
    m.role = d.role || po.chain || "pair";
    po.matches.push(m);
  });
}

function resolveLivePlayoff(ctx) {
  ctx = ctx || getCutoffContext();
  if (!ctx?.needed) return { resolved: true, qualifierIds: (ctx?.group || []).map((p) => p.id), nextMatches: [] };
  const analysis = analyzeLiveCutoff(ctx);
  if (analysis.resolved && !analysis.needsMatches) {
    return { resolved: true, qualifierIds: analysis.qualifierIds || [], nextMatches: [] };
  }
  const po = state.cutPlayoff;
  if (!po || !po.chain) return { resolved: false, qualifierIds: null, nextMatches: [] };
  return BaoluoCutoff.resolvePlayoff(decorateCutoffGroup(ctx.group), ctx.spots, headToHead, po, havePlayed);
}

function cutPlayoffComplete() {
  const ctx = getCutoffContext();
  if (!ctx.needed) return true;
  const r = resolveLivePlayoff(ctx);
  return !!r.resolved;
}

function maybeAdvanceCutPlayoff() {
  const po = state.cutPlayoff;
  if (!po?.matches?.length) return;
  const ctx = getCutoffContext();
  if (!ctx.needed) return;
  const r = BaoluoCutoff.resolvePlayoff(decorateCutoffGroup(ctx.group), ctx.spots, headToHead, po, havePlayed);
  if (r.phase) po.phase = r.phase;
  if (r.byeId) po.byeId = r.byeId;
  if (r.challengerId) po.challengerId = r.challengerId;
  if (r.preQualifyIds) po.preQualifyIds = r.preQualifyIds;
  if (r.chain) po.chain = r.chain;
  if (r.ko) po.ko = r.ko;
  if (r.tiedIds) po.tiedIds = r.tiedIds;
  if (r.take != null) po.take = r.take;
  appendPlayoffMatches(po, r.nextMatches);
}

function generateCutoffPlayoff() {
  if (!ensureQualifyEngineForAction("產生入圍加賽")) return;
  const ctx = getCutoffContext();
  if (!ctx.needed) {
    toast("入圍名額已可分清，唔使加賽", "success");
    return;
  }
  const analysis = analyzeLiveCutoff(ctx);
  if (analysis.resolved && !analysis.needsMatches) {
    toast("依家用總分／對賽已可分高下，無需產生加賽", "success");
    return;
  }
  const nameOf = (id) => playerById(id)?.name || id;
  const built = BaoluoCutoff.materializeCutoff(analysis, Math.random, nameOf, havePlayed);
  if (!built.firstMatches?.length) {
    toast("依家用總分／對賽已可分高下，無需產生加賽", "success");
    return;
  }
  const matches = [];
  const po = { matches, chain: built.chain };
  appendPlayoffMatches(po, built.firstMatches);
  state.cutPlayoff = {
    spots: ctx.spots,
    cutScore: ctx.cutScore,
    koN: ctx.koN,
    playerIds: ctx.group.map((p) => p.id),
    tiedIds: built.tiedIds || analysis.tiedIds || [],
    preQualifyIds: built.preQualifyIds || analysis.preQualifyIds || [],
    matches,
    chain: built.chain,
    ko: built.ko || null,
    byeId: built.byeId || null,
    challengerId: built.challengerId || null,
    autoOpen: built.autoOpen,
    phase: built.phase || null,
    inner: built.inner || null,
    multiBye: !!built.multiBye,
    take: built.take,
    byeBp: built.byeBp || null,
    rule: built.rule || getQualifyRule(),
    seedId: built.seedId || null,
    bOrdered: !!built.bOrdered,
  };
  saveState({ backup: "產生入圍加賽" });
  render();
  switchTab("pairings");
  const hint = isWinInPlayoff(state.cutPlayoff)
    ? "打贏出線（唔計 BP）"
    : "先到 4，打完加本場 BP 再比（打贏唔等於入圍）";
  toast(`已產生入圍加賽。${hint}`, "success");
}

function isWinInPlayoff(po) {
  if (getQualifyRule() === "B") return true;
  const c = String(po && po.chain ? po.chain : "");
  return c === "seedKo" || c === "elim1" || c === "crossDraw" || c.startsWith("b");
}

function playoffQualifiers(ctx) {
  ctx = ctx || getCutoffContext();
  const r = resolveLivePlayoff(ctx);
  if (!r.resolved) return null;
  return r.qualifierIds || [];
}

function sortRuleBKoSeeds(players) {
  const byeAdjust = ruleBUsesByeAdjust();
  return [...players].sort((a, b) => {
    const sa = cutoffScoreOf(a, byeAdjust);
    const sb = cutoffScoreOf(b, byeAdjust);
    if (sb !== sa) return sb - sa;
    if ((b.netPoints || 0) !== (a.netPoints || 0)) return b.netPoints - a.netPoints;
    if ((b.battlePoints || 0) !== (a.battlePoints || 0)) return b.battlePoints - a.battlePoints;
    const h = headToHead(a.id, b.id);
    if (h === a.id) return -1;
    if (h === b.id) return 1;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
  });
}

function cutoffSeedList() {
  const ctx = getCutoffContext();
  const ranked = rankedPlayers();
  const koN = ctx.koN || getKoBracketSize();
  const pick = (list) =>
    getQualifyRule() === "B" ? sortRuleBKoSeeds(list).slice(0, koN) : list.slice(0, koN);
  if (!ctx.needed) return pick(ranked);
  const qids = playoffQualifiers(ctx);
  if (!qids) return null;
  const locked = (ctx.lockedIn || []).map((p) => p.id);
  const extra = qids.filter((id) => !locked.includes(id));
  const idSet = new Set([...locked, ...extra]);
  return pick(ranked.filter((p) => idSet.has(p.id)));
}

function isSwissFinishedForKo() {
  const completed = state.rounds.filter((r) => r.locked).length;
  return completed >= getSwissRounds() || state.phase === "knockout" || state.phase === "done";
}

function isKoQualified(playerId) {
  if (!isSwissFinishedForKo()) return false;
  const seeds = cutoffSeedList();
  if (seeds) return seeds.some((p) => p.id === playerId);
  const ctx = getCutoffContext();
  return !!(ctx.lockedIn && ctx.lockedIn.some((p) => p.id === playerId));
}

// ─── Swiss Pairing Algorithm ─────────────────────────────
/**
 * Priority:
 * a. Same score group first
 * b. Prefer different church
 * c. Avoid rematches（先硬避，不行再軟罰）
 *
 * n≤20：限時 backtracking；n≥24：greedy（防 UI 卡死）
 */
function isLatePlayer(p) {
  if (!p) return false;
  if (p.late === true) return true;
  const full = playerById(p.id);
  return !!(full && full.late);
}

function pairQuality(p1, p2, playedSet, lastOpp, hardNoRematch) {
  const key = pairKey(p1.id, p2.id);
  if (hardNoRematch && playedSet.has(key)) return -Infinity;

  let q = 0;
  const scoreDiff = Math.abs(p1.swissPoints - p2.swissPoints);
  q -= scoreDiff * 10000;

  const late1 = isLatePlayer(p1);
  const late2 = isLatePlayer(p2);
  if (late1 !== late2) q -= 40000;
  else if (late1 && late2) q += 800;

  if (p1.church !== p2.church) q += 1000;
  else q -= 200;

  if (playedSet.has(key)) q -= 5000;
  else q += 300;

  if (lastOpp[p1.id] === p2.id || lastOpp[p2.id] === p1.id) q -= 8000;
  else q += 100;

  return q;
}

function pairKey(a, b) {
  return a < b ? a + "|" + b : b + "|" + a;
}

function buildPlayedSet() {
  const set = new Set();
  for (const r of state.rounds) {
    for (const m of r.matches) {
      if (isByeMatch(m) || !m.p1 || !m.p2) continue;
      set.add(pairKey(m.p1, m.p2));
    }
  }
  return set;
}

function buildLastOppMap() {
  const map = {};
  const locked = state.rounds.filter((r) => r.locked);
  const prev = locked[locked.length - 1];
  if (!prev) return map;
  for (const m of prev.matches) {
    if (isByeMatch(m) || !m.p1 || !m.p2) continue;
    map[m.p1] = m.p2;
    map[m.p2] = m.p1;
  }
  return map;
}

function countRematches(pairs, playedSet) {
  let n = 0;
  for (const [a, b] of pairs) {
    if (!a || !b) continue;
    if (playedSet.has(pairKey(a.id, b.id))) n++;
  }
  return n;
}

function byeCount(playerId) {
  let n = 0;
  for (const r of state.rounds || []) {
    for (const m of r.matches || []) {
      if (isByeMatch(m) && m.p1 === playerId && m.winner === playerId && !m.lateSitLoss) n++;
    }
  }
  return n;
}

/** 坐場次數（含遲到坐場 0–4），用來輪流坐，避免同一人連坐 */
function sitCount(playerId) {
  let n = 0;
  for (const r of state.rounds || []) {
    for (const m of r.matches || []) {
      if (isByeMatch(m) && m.p1 === playerId) n++;
    }
  }
  return n;
}

function currentRankMap() {
  const map = {};
  for (const p of rankedPlayers()) map[p.id] = p.rank;
  return map;
}

/** 曾否打過而家名次更高嘅人；bestFaced = 對手入面最好（最細）名次 */
function facedHigherRankInfo(playerId, rankOf) {
  const myRank = rankOf[playerId] ?? 9999;
  let faced = false;
  let bestFaced = Infinity;
  for (const r of state.rounds || []) {
    for (const m of r.matches || []) {
      if (isByeMatch(m) || !m.p1 || !m.p2) continue;
      let opp = null;
      if (m.p1 === playerId) opp = m.p2;
      else if (m.p2 === playerId) opp = m.p1;
      if (!opp) continue;
      const or = rankOf[opp] ?? 9999;
      if (or < myRank) faced = true;
      if (or < bestFaced) bestFaced = or;
    }
  }
  return { faced, bestFaced };
}

/** 以而家排名計，成組都入到淘汰賽名額（穩入圍） */
function isLockedForKo(player) {
  const koN = getKoBracketSize();
  const ranked = rankedPlayers();
  const above = ranked.filter((p) => p.swissPoints > player.swissPoints).length;
  const same = ranked.filter((p) => p.swissPoints === player.swissPoints).length;
  return above < koN && above + same <= koN;
}

function remainingRoundsAfterThis() {
  const thisRound = state.currentRound || (state.rounds || []).length + 1;
  return Math.max(0, getSwissRounds() - thisRound);
}

function hasRealSwissResult(m) {
  return !!(m && m.done && !isByeMatch(m) && !m.lateForfeit);
}

/** 即使今輪自動獲勝＋之後全勝，都追唔上已有 koN 個更高勝場 */
function noHopeWithBye(player) {
  const koN = getKoBracketSize();
  const maxSwiss = (player.swissPoints || 0) + 1 + remainingRoundsAfterThis();
  const others = rankedPlayers().filter((p) => p.id !== player.id);
  return others.filter((p) => p.swissPoints > maxSwiss).length >= koN;
}

/** 僅最後一輪瑞士：0 穩入圍  1 無希望  2 其他人 */
function lastRoundByeBucket(player) {
  if (isLockedForKo(player)) return 0;
  if (noHopeWithBye(player)) return 1;
  return 2;
}

/**
 * 單數人「無對手」優先序：
 * 遲到者優先坐場（坐場計 0–4 負，唔係自動勝）
 * 其後輪流坐 → 最後一輪：已穩入圍 → 已無希望
 * 其後：勝場最多 → 曾打過更高名次 → BP 較高
 */
function pickByePlayer(players) {
  const list = [...players];
  if (!list.length) return null;
  const minSit = Math.min(...list.map((p) => sitCount(p.id)));
  const lastRound = remainingRoundsAfterThis() === 0;
  const rankOf = currentRankMap();
  list.sort((a, b) => {
    const aLate = isLatePlayer(a) ? 0 : 1;
    const bLate = isLatePlayer(b) ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;
    const aOk = sitCount(a.id) === minSit ? 0 : 1;
    const bOk = sitCount(b.id) === minSit ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    if (lastRound) {
      const ia = lastRoundByeBucket(a);
      const ib = lastRoundByeBucket(b);
      if (ia !== ib) return ia - ib;
    }
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    const fa = facedHigherRankInfo(a.id, rankOf);
    const fb = facedHigherRankInfo(b.id, rankOf);
    if (fa.faced !== fb.faced) return fa.faced ? -1 : 1;
    if (fa.faced && fb.faced && fa.bestFaced !== fb.bestFaced) return fa.bestFaced - fb.bestFaced;
    if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
  });
  return list[0] || null;
}

function pairPlayersList(pool, playedSet, lastOpp, roundOne) {
  if (!pool.length) return [];
  if (pool.length % 2 !== 0) return [];
  if (roundOne) return pairRoundOne(pool).filter((pr) => pr[0] && pr[1]);
  const n = pool.length;
  let pairs;
  if (n >= 24) {
    pairs = greedyPairPreferNoRematch(pool, playedSet, lastOpp);
  } else {
    pairs = bestPairingSearch(pool, playedSet, lastOpp, { timeMs: 250 });
    if (!pairs) pairs = greedyPairPreferNoRematch(pool, playedSet, lastOpp);
  }
  return pairs || [];
}

function generateSwissPairings() {
  const stats = state.players.map((p) => {
    const s = getPlayerStats(p.id);
    return { ...p, ...s, late: !!p.late };
  });

  stats.sort((a, b) => {
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
    return a.name.localeCompare(b.name, "zh-Hant");
  });

  const playedSet = buildPlayedSet();
  const lastOpp = buildLastOppMap();
  const roundOne = state.rounds.length === 0;

  let pool = stats;
  let bye = null;
  if (pool.length % 2 === 1) {
    bye = pickByePlayer(pool);
    if (bye) pool = pool.filter((p) => p.id !== bye.id);
  }

  const ontime = pool.filter((p) => !isLatePlayer(p));
  const late = pool.filter((p) => isLatePlayer(p));

  const splitEven = (group) => {
    const g = [...group];
    let leftover = null;
    if (g.length % 2 === 1) leftover = g.pop();
    const pairs = g.length ? pairPlayersList(g, playedSet, lastOpp, roundOne) : [];
    return { pairs, leftover };
  };

  const a = splitEven(ontime);
  const b = splitEven(late);
  const pairs = [...(a.pairs || []), ...(b.pairs || [])];
  if (a.leftover && b.leftover) pairs.push([a.leftover, b.leftover]);
  else if (a.leftover) pairs.push([a.leftover, null]);
  else if (b.leftover) pairs.push([b.leftover, null]);
  if (bye) pairs.push([bye, null]);

  const rem = countRematches(pairs.filter((pr) => pr[0] && pr[1]), playedSet);
  if (rem > 0) {
    setTimeout(() => toast(`注意：本輪有 ${rem} 對重賽（無法完全避免時會允許）`, "error"), 0);
  }
  const mixed = pairs.filter(([x, y]) => x && y && isLatePlayer(x) !== isLatePlayer(y)).length;
  if (mixed > 0) {
    setTimeout(() => toast(`有 ${mixed} 場對上遲到選手：遲到方自動 0–4`, "error"), 80);
  }
  return pairs;
}

function pairRoundOne(players) {
  const kcc = players.filter((p) => p.church === "kcc");
  const ky = players.filter((p) => p.church === "ky");
  kcc.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  ky.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

  const pairs = [];
  const used = new Set();

  const n = Math.min(kcc.length, ky.length);
  for (let i = 0; i < n; i++) {
    pairs.push([kcc[i], ky[i]]);
    used.add(kcc[i].id);
    used.add(ky[i].id);
  }
  const left = players.filter((p) => !used.has(p.id));
  for (let i = 0; i < left.length; i += 2) {
    if (left[i + 1]) pairs.push([left[i], left[i + 1]]);
    else pairs.push([left[i], null]);
  }
  return pairs;
}

function bestPairingSearch(players, playedSet, lastOpp, opts = {}) {
  const n = players.length;
  if (n % 2 !== 0) return null;

  const ids = players.map((p) => p.id);
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  let bestPairs = null;
  let bestScore = -Infinity;
  const deadline = Date.now() + (opts.timeMs || 250);
  let timedOut = false;

  function search(unpaired, pairs, scoreSoFar, hardNoRematch) {
    if (timedOut || Date.now() > deadline) {
      timedOut = true;
      return;
    }
    if (unpaired.length === 0) {
      if (scoreSoFar > bestScore) {
        bestScore = scoreSoFar;
        bestPairs = pairs.map((pr) => [byId[pr[0]], byId[pr[1]]]);
      }
      return;
    }
    if (bestPairs && scoreSoFar + unpaired.length * 2000 < bestScore) return;

    const a = unpaired[0];
    const rest = unpaired.slice(1);

    const candidates = rest
      .map((b) => ({
        b,
        q: pairQuality(byId[a], byId[b], playedSet, lastOpp, hardNoRematch),
      }))
      .filter((x) => x.q !== -Infinity)
      .sort((x, y) => y.q - x.q);

    if (!candidates.length && hardNoRematch) return;

    const limit = Math.min(candidates.length, n <= 12 ? 8 : 6);
    for (let i = 0; i < limit; i++) {
      const { b, q } = candidates[i];
      const nextUnpaired = rest.filter((x) => x !== b);
      search(nextUnpaired, [...pairs, [a, b]], scoreSoFar + q, hardNoRematch);
      if (bestScore > 5000 * (n / 2) - 1000 && i >= 2) break;
      if (timedOut) break;
    }
  }

  // 先硬避 rematch，再軟罰
  search(ids, [], 0, true);
  if (!bestPairs) {
    timedOut = false;
    search(ids, [], 0, false);
  }
  return bestPairs;
}

function greedyPairPreferNoRematch(players, playedSet, lastOpp) {
  const hard = greedyPair(players, playedSet, lastOpp, true);
  if (hard && hard.length === players.length / 2) return hard;
  return greedyPair(players, playedSet, lastOpp, false);
}

function greedyPair(players, playedSet, lastOpp, hardNoRematch = false) {
  const remaining = [...players];
  const pairs = [];
  while (remaining.length >= 2) {
    const a = remaining.shift();
    let bestIdx = -1;
    let bestQ = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const q = pairQuality(a, remaining[i], playedSet, lastOpp, hardNoRematch);
      if (q > bestQ) {
        bestQ = q;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || bestQ === -Infinity) {
      // hard 模式失敗
      if (hardNoRematch) return null;
      bestIdx = 0;
    }
    const b = remaining.splice(bestIdx, 1)[0];
    pairs.push([a, b]);
  }
  return pairs;
}

/**
 * 同分／無法自動判定時：用 modal 人手揀勝方（唔用 prompt，平板較穩）
 * @returns {Promise<string|null>} winnerId
 */
function resolveForceWinner(p1Id, p2Id, p1Bp, p2Bp) {
  const auto = autoWinnerFromScores(p1Id, p2Id, p1Bp, p2Bp);
  if (auto) return Promise.resolve(auto);
  const a = Math.max(0, parseInt(p1Bp, 10) || 0);
  const b = Math.max(0, parseInt(p2Bp, 10) || 0);
  if (a > b) return Promise.resolve(p1Id);
  if (b > a) return Promise.resolve(p2Id);
  // 平手：無分（唔揀勝方）
  return Promise.resolve(null);
}

/** 先到 4 自動勝；總分相同＝無分 */
function resolveWinnerForScores(p1Id, p2Id, p1Bp, p2Bp) {
  return Promise.resolve(autoWinnerFromScores(p1Id, p2Id, p1Bp, p2Bp));
}

let _tieWinnerResolve = null;

function pickWinnerByModal(p1Id, p2Id, p1Bp, p2Bp, reason) {
  return new Promise((resolve) => {
    const modal = document.getElementById("tieWinnerModal");
    const body = document.getElementById("tieWinnerModalBody");
    const title = document.getElementById("tieWinnerModalTitle");
    if (!modal || !body) {
      toast("無法開啟勝方選擇（介面缺失）", "error");
      resolve(null);
      return;
    }
    // 若已有未完成選擇，先取消舊嘅
    if (_tieWinnerResolve) {
      _tieWinnerResolve(null);
      _tieWinnerResolve = null;
    }
    _tieWinnerResolve = resolve;
    const p1 = playerById(p1Id);
    const p2 = playerById(p2Id);
    if (title) title.textContent = "指定勝方";
    const s1 = Math.max(0, parseInt(p1Bp, 10) || 0);
    const s2 = Math.max(0, parseInt(p2Bp, 10) || 0);
    body.innerHTML = `
      <div class="hint" style="margin-top:0">${escapeHtml(reason || "請選擇勝方")}</div>
      <div class="tie-score-line">比分 <strong>${s1}</strong> : <strong>${s2}</strong></div>
      <div class="tie-pick-grid">
        <button type="button" class="btn btn-primary btn-tie-pick" data-id="${escapeAttr(p1Id)}">
          <span class="tie-pick-name">${escapeHtml(p1?.name || "選手1")}</span>
          <span class="meta">勝方 · ${s1} 分</span>
        </button>
        <button type="button" class="btn btn-primary btn-tie-pick" data-id="${escapeAttr(p2Id)}">
          <span class="tie-pick-name">${escapeHtml(p2?.name || "選手2")}</span>
          <span class="meta">勝方 · ${s2} 分</span>
        </button>
      </div>
      <button type="button" class="btn btn-ghost" id="btnTieCancel" style="width:100%;margin-top:12px">取消</button>
    `;
    const finish = (id) => {
      modal.classList.add("hidden");
      const r = _tieWinnerResolve;
      _tieWinnerResolve = null;
      if (r) r(id);
    };
    body.querySelectorAll(".btn-tie-pick").forEach((btn) => {
      btn.addEventListener("click", () => finish(btn.dataset.id));
    });
    document.getElementById("btnTieCancel")?.addEventListener("click", () => {
      toast("已取消：必須指定勝方", "error");
      finish(null);
    });
    modal.classList.remove("hidden");
  });
}

function closeTieWinnerModal() {
  document.getElementById("tieWinnerModal")?.classList.add("hidden");
  if (_tieWinnerResolve) {
    const r = _tieWinnerResolve;
    _tieWinnerResolve = null;
    r(null);
  }
}

/** 標準種子 bracket 順序：4→[1,4,2,3]；8→[1,8,4,5,2,7,3,6]… */
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

function makeKoMatch(label, p1, p2) {
  return {
    id: uid("ko"),
    label,
    p1,
    p2,
    winner: null,
    p1Bp: 0,
    p2Bp: 0,
    done: false,
    battles: emptyBattles(),
    p1BeyOrder: emptyBeyOrder(),
    p2BeyOrder: emptyBeyOrder(),
  };
}

/** 出場次序：3 個位置，值為選手 beys 陣列 index（0/1/2），未定為 null */
function emptyBeyOrder() {
  return [null, null, null];
}

function normalizeBeyOrder(order) {
  if (!Array.isArray(order) || order.length !== 3) return emptyBeyOrder();
  return order.map((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 && n <= 2 ? n : null;
  });
}

function isBeyOrderComplete(order) {
  const o = normalizeBeyOrder(order);
  if (o.some((x) => x === null)) return false;
  // 三隻應各用一次（排列）
  return new Set(o).size === 3;
}

function beyShortAt(player, beyIndex) {
  if (!player || beyIndex === null || beyIndex === undefined) return "—";
  normalizePlayer(player);
  const b = player.beys?.[beyIndex];
  if (!b) return "—";
  return beyLabel(b, { short: true });
}

/** 顯示：① UX15 3-60 O ／ ② … */
function formatBeyOrderLines(player, order) {
  const o = normalizeBeyOrder(order);
  return [0, 1, 2].map((slot) => {
    const idx = o[slot];
    const label = idx === null ? "未定" : beyShortAt(player, idx);
    return { slot: slot + 1, beyIndex: idx, label };
  });
}

function formatBeyOrderCompact(player, order) {
  if (!isBeyOrderComplete(order) && !normalizeBeyOrder(order).some((x) => x !== null)) {
    return "次序未登記";
  }
  return formatBeyOrderLines(player, order)
    .map((x) => `${x.slot}.${x.label}`)
    .join(" → ");
}

function applyLateSitLossIfNeeded(m) {
  if (!m || !isByeMatch(m) || !m.p1) return m;
  if (!isLatePlayer(playerById(m.p1))) return m;
  m.lateSitLoss = true;
  m.winner = null;
  m.p1Bp = 0;
  m.p2Bp = MATCH_TARGET;
  m.done = true;
  m.draw = false;
  return m;
}

function applyLateForfeitIfNeeded(m) {
  if (!m || m.bye || !m.p1 || !m.p2) return m;
  const l1 = isLatePlayer(playerById(m.p1));
  const l2 = isLatePlayer(playerById(m.p2));
  if (l1 === l2) return m;
  const winnerId = l1 ? m.p2 : m.p1;
  m.lateForfeit = true;
  m.done = true;
  m.draw = false;
  m.winner = winnerId;
  m.p1Bp = winnerId === m.p1 ? MATCH_TARGET : 0;
  m.p2Bp = winnerId === m.p2 ? MATCH_TARGET : 0;
  m.battles = [0, 1, 2, 3].map(() => ({
    id: uid("b"),
    p1BeyIndex: 0,
    p2BeyIndex: 0,
    winnerId,
    finishType: "spin",
    points: 1,
  }));
  return m;
}

function createRoundFromPairs(pairs, roundNum) {
  const raw = pairs.map((pair, i) => {
    const p1 = pair[0];
    const p2 = pair[1];
    const bye = !p2;
    const m = {
      id: uid("m"),
      table: i + 1,
      p1: p1.id,
      p2: p2 ? p2.id : null,
      bye,
      winner: bye ? p1.id : null,
      p1Bp: 0,
      p2Bp: 0,
      done: bye,
      p1BeyOrder: emptyBeyOrder(),
      p2BeyOrder: emptyBeyOrder(),
      battles: emptyBattles(),
    };
    if (bye) applyLateSitLossIfNeeded(m);
    else applyLateForfeitIfNeeded(m);
    return m;
  });
  return {
    round: roundNum,
    locked: false,
    matches: assignMatchZones(raw),
  };
}

function findMatchById(matchId) {
  for (const r of state.rounds) {
    const m = r.matches.find((x) => x.id === matchId);
    if (m) return { match: m, round: r, playoff: false };
  }
  const po = state.cutPlayoff?.matches || [];
  const m = po.find((x) => x.id === matchId);
  if (m) {
    return {
      match: m,
      round: { locked: false, matches: po },
      playoff: true,
    };
  }
  return null;
}

function ensureMatchBeyOrders(m) {
  if (!m.p1BeyOrder) m.p1BeyOrder = emptyBeyOrder();
  else m.p1BeyOrder = normalizeBeyOrder(m.p1BeyOrder);
  if (!m.p2BeyOrder) m.p2BeyOrder = emptyBeyOrder();
  else m.p2BeyOrder = normalizeBeyOrder(m.p2BeyOrder);
  if (!Array.isArray(m.battles)) m.battles = emptyBattles();
  else m.battles = normalizeBattles(m.battles);
}

/** 第 n 場 battle（0-based）預設用出場次序第 n 隻 */
function defaultBeyIndexForBattle(order, battleIndex) {
  const o = normalizeBeyOrder(order);
  if (o[battleIndex] !== null && o[battleIndex] !== undefined) return o[battleIndex];
  if (battleIndex <= 2) return battleIndex;
  return null;
}

function saveSettingsFromForm() {
  const referees = parseInt(document.getElementById("setReferees")?.value, 10);
  const stadiums = parseInt(document.getElementById("setStadiums")?.value, 10);
  const swissRounds = parseInt(document.getElementById("setSwissRounds")?.value, 10);
  const playerPreset = document.getElementById("setPlayerPreset")?.value || "16";
  const koSize = parseInt(document.getElementById("setKoSize")?.value, 10);
  const qualifyRule = document.getElementById("setQualifyRule")?.value || "A";
  let playerCount;
  if (playerPreset === "other") {
    playerCount = parseInt(document.getElementById("setPlayerCountCustom")?.value, 10);
  } else {
    playerCount = parseInt(playerPreset, 10);
  }

  const prev = normalizeSettings(state.settings);
  const next = normalizeSettings({
    referees,
    stadiums,
    swissRounds,
    playerCount,
    playerPreset,
    koSize,
    qualifyRule,
  });

  if (state.phase !== "setup" && next.playerCount !== getTotalPlayers()) {
    toast("比賽已開始，無法更改參賽人數", "error");
    renderSettings();
    return;
  }
  if (state.phase === "setup" && state.players.length > next.playerCount) {
    if (
      !confirm(
        `目前已有 ${state.players.length} 人，新上限為 ${next.playerCount} 人。\n多出嘅選手不會自動刪除，請自行刪減。仍儲存設定？`
      )
    ) {
      renderSettings();
      return;
    }
  }

  // 瑞士輪警告（可無視）
  const { messages } = warnEventFormat(next.playerCount, next.swissRounds, next.koSize);
  const bad = messages.filter((m) => m.level === "warn" || m.level === "danger");
  if (bad.length) {
    const text = bad.map((m) => "· " + m.text).join("\n");
    if (!confirm(`瑞士制輪數提示（可無視）：\n${text}\n\n仍要儲存此設定？`)) {
      renderSettings();
      return;
    }
  }

  if (next.koSize > next.playerCount) {
    toast("淘汰賽名額不可超過參賽人數", "error");
    renderSettings();
    return;
  }

  if (next.qualifyRule !== prev.qualifyRule && (state.knockout || state.cutPlayoff)) {
    if (
      !confirm(
        "入圍規則改動唔會改現有加賽／淘汰賽。\n重做淘汰賽或重新產生加賽先會用新規則。仍儲存？"
      )
    ) {
      renderSettings();
      return;
    }
  }

  const prevSwiss = getSwissRounds();
  const prevKo = getKoBracketSize();
  const lockedCount = state.rounds.filter((r) => r.locked).length;

  // 仍可改瑞士輪數：給安全提示／必要時重開瑞士階段（保留可改）
  if (state.phase !== "setup" && next.swissRounds !== prevSwiss) {
    if (state.knockout) {
      if (
        !confirm(
          `淘汰賽已產生。改瑞士輪數（${prevSwiss}→${next.swissRounds}）唔會改動現有 bracket。\n若要按新排名重產淘汰賽，請之後用「重做淘汰賽」。仍儲存？`
        )
      ) {
        renderSettings();
        return;
      }
    } else if (next.swissRounds < lockedCount) {
      if (
        !confirm(
          `已鎖定 ${lockedCount} 輪，新設定只有 ${next.swissRounds} 輪。\n多出嘅輪次資料會保留，但「是否完結瑞士」會以新輪數為準。仍儲存？`
        )
      ) {
        renderSettings();
        return;
      }
    } else if (next.swissRounds > prevSwiss && lockedCount >= prevSwiss) {
      // 延長瑞士制：若已標記完結但未產 bracket，重開瑞士並產下一輪
      if (
        !confirm(
          `將瑞士制由 ${prevSwiss} 輪延長至 ${next.swissRounds} 輪？\n若已結束瑞士制但未產生淘汰賽，會重新開放瑞士配對。`
        )
      ) {
        renderSettings();
        return;
      }
    }
  }

  if (state.knockout && next.koSize !== prevKo) {
    if (
      !confirm(
        `淘汰賽 bracket 已係 ${state.knockout.bracketSize} 強。\n設定改為 ${next.koSize} 強只影響「重做淘汰賽」後；現有對戰唔會自動改。仍儲存？`
      )
    ) {
      renderSettings();
      return;
    }
  }

  state.settings = next;

  // 延長瑞士且未有 knockout：回到 swiss 並補下一輪（若需要）
  if (
    state.phase !== "setup" &&
    !state.knockout &&
    next.swissRounds > lockedCount &&
    lockedCount > 0 &&
    state.rounds.every((r) => r.locked)
  ) {
    state.phase = "swiss";
    state.currentRound = lockedCount + 1;
    if (!state.rounds.some((r) => r.round === state.currentRound)) {
      const pairs = generateSwissPairings();
      state.rounds.push(createRoundFromPairs(pairs, state.currentRound));
    }
  }

  // 未鎖定輪次重新分配報到區
  state.rounds.forEach((r) => {
    if (!r.locked) r.matches = assignMatchZones(r.matches);
  });
  saveState({ backup: "儲存設定" });
  render();
  toast(
    `已儲存：${state.settings.playerCount} 人 · 瑞士 ${getSwissRounds()} 輪 · 淘汰 ${getKoBracketSize()} 強 · 入圍 ${qualifyRuleLabel(next.qualifyRule)} · 站 ${getActiveStations()}`,
    "success"
  );
}

function syncPlayerCountCustomVisibility() {
  const preset = document.getElementById("setPlayerPreset")?.value;
  const wrap = document.getElementById("playerCountCustomWrap");
  if (wrap) wrap.style.display = preset === "other" ? "" : "none";
}

// ─── Church radio helpers（二選一，原生互斥）────────────
function getSelectedChurch(rootSelector) {
  const root = typeof rootSelector === "string" ? document.querySelector(rootSelector) : rootSelector;
  if (!root) return null;
  const checked = root.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
  return checked ? checked.value : null;
}

function syncChurchCheckStyles(root) {
  if (!root) return;
  root.querySelectorAll(".church-check").forEach((lab) => {
    const inp = lab.querySelector("input");
    lab.classList.toggle("on", !!(inp && inp.checked));
  });
}

// ─── Actions ─────────────────────────────────────────────
function makePlayer(name, church, beys) {
  return normalizePlayer({
    id: uid("p"),
    name,
    church,
    beys: beys || emptyBeys(),
    deckChecked: false,
  });
}

function addPlayer(name, church, opts = {}) {
  name = (name || "").trim();
  if (!name) {
    toast("請輸入姓名", "error");
    return false;
  }
  if (state.phase !== "setup" && state.phase !== "swiss") {
    toast("瑞士制已結束，無法再加入比賽選手。場外人士可去「抽籤」加入名單。", "error");
    return false;
  }
  const lateJoin = !!(opts.late || state.phase === "swiss");
  if (state.players.length >= 128) {
    toast("最多 128 人", "error");
    return false;
  }
  if (state.players.length >= getTotalPlayers()) {
    if (state.phase === "setup") {
      toast(`已滿 ${getTotalPlayers()} 人`, "error");
      return false;
    }
    const next = state.players.length + 1;
    state.settings.playerCount = next;
    state.settings.playerPreset = PLAYER_PRESETS.includes(next) ? String(next) : "other";
  }
  if (!CHURCH[church]) {
    toast("教會無效", "error");
    return false;
  }
  const p = makePlayer(name, church);
  p.late = lateJoin || !!opts.late;
  if (p.late) p.lateAt = new Date().toISOString();
  state.players.push(p);
  saveState();
  render();
  if (p.late && state.phase === "swiss") {
    maybeIncludeLateInCurrentRound(p);
  } else {
    toast(p.late ? `已加入遲到選手：${name}` : `已預先登記：${name}`, "success");
  }
  return true;
}

function maybeIncludeLateInCurrentRound(player) {
  const round = currentRoundObj();
  if (!round || round.locked) {
    toast(`${player.name} 已加入（遲到）。本輪已鎖定，下一輪開始配對。`, "success");
    return;
  }
  const realDone = round.matches.some(hasRealSwissResult);
  if (realDone) {
    toast(`${player.name} 已加入（遲到）。本輪已有賽果，下一輪開始配對。`, "success");
    return;
  }
  if (
    confirm(
      `${player.name} 已標為遲到（已知會遲到、尚未到場）。\n將重配本輪：遲到者優先坐場（0–4 負）或對上準時自動 0–4。\n到場後請取消「遲到」勾選，之後輪次當準時。重配？`
    )
  ) {
    state.rounds = state.rounds.filter((r) => r.round !== round.round);
    const pairs = generateSwissPairings();
    state.rounds.push(createRoundFromPairs(pairs, state.currentRound));
    state.rounds.sort((a, b) => a.round - b.round);
    saveState();
    render();
    toast("已加入遲到選手並重配本輪", "success");
    return;
  }
  toast(`${player.name} 已加入（遲到）。未重配，可由下一輪開始。`, "success");
}

function setPlayerLate(id, late) {
  const p = playerById(id);
  if (!p) return;
  p.late = !!late;
  p.lateAt = new Date().toISOString();
  let clearedForfeit = false;
  const round = currentRoundObj();
  if (round && !round.locked) {
    round.matches.forEach((m) => {
      if (isByeMatch(m) && m.p1 === id) {
        if (late) applyLateSitLossIfNeeded(m);
        // 取消遲到：本輪已坐場嘅 0–4 保留（之後輪次先當準時）
        return;
      }
      if (m.lateForfeit) {
        const l1 = isLatePlayer(playerById(m.p1));
        const l2 = isLatePlayer(playerById(m.p2));
        if (l1 === l2) {
          m.lateForfeit = false;
          m.done = false;
          m.winner = null;
          m.p1Bp = 0;
          m.p2Bp = 0;
          m.battles = emptyBattles();
          clearedForfeit = true;
        }
      } else if (!m.done) {
        applyLateForfeitIfNeeded(m);
      }
    });
  }
  saveState();
  render();
  if (!late) {
    toast(
      clearedForfeit
        ? `${p.name} 已到場：本場改為正式對賽（可入分）。之後輪次當準時，唔會再自動 0–4。`
        : `${p.name} 已取消遲到。本輪已記嘅坐場 0–4 會保留；之後輪次當準時配對。`,
      "success"
    );
  }
}

function removePlayer(id) {
  if (state.phase !== "setup") {
    toast("比賽已開始，無法刪除選手", "error");
    return;
  }
  state.players = state.players.filter((p) => p.id !== id);
  saveState();
  render();
}

function updatePlayerName(id, name) {
  const p = playerById(id);
  if (!p) return;
  p.name = (name || "").trim() || p.name;
  p.nameAt = new Date().toISOString();
  saveState();
}

function updatePlayerChurch(id, church) {
  if (state.phase !== "setup") {
    toast("比賽開始後不宜改教會（影響配對統計）", "error");
    render();
    return;
  }
  const p = playerById(id);
  if (!p || !CHURCH[church]) return;
  p.church = church;
  saveState();
  render();
}

/** 產生可區分嘅示範姓名（支援 32／64） */
function demoPlayerName(i) {
  if (i < DEMO_PLAYERS.length) return DEMO_PLAYERS[i][0];
  const base = DEMO_PLAYERS[i % DEMO_PLAYERS.length][0];
  const batch = Math.floor(i / DEMO_PLAYERS.length);
  // 姓 + 編號，避免「陳大文2」難分辨
  const surnames = ["趙", "錢", "孫", "李", "周", "吳", "鄭", "王", "馮", "陳", "褚", "衛", "蔣", "沈", "韓", "楊"];
  const given = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "文", "武", "豪", "希", "樂", "安"];
  return `${surnames[i % surnames.length]}${given[Math.floor(i / surnames.length) % given.length]}${batch > 0 ? batch + 1 : ""}`;
}

function fillDemo() {
  if (state.phase !== "setup") return;
  const n = getTotalPlayers();
  const list = [];
  for (let i = 0; i < n; i++) {
    const name = demoPlayerName(i);
    const church = i % 2 === 0 ? "kcc" : "ky";
    const template = DEMO_DECKS[i % DEMO_DECKS.length];
    const beys = template.map(demoBeyFromTemplate);
    const p = makePlayer(name, church, beys);
    p.deckChecked = true;
    list.push(p);
  }
  state.players = list;
  saveState();
  render();
  toast(`已填入 ${n} 人 + 示範陀螺配置`, "success");
}

function startTournament() {
  if (!state.instanceId) state.instanceId = newTournamentInstanceId();
  const n = state.players.length;
  if (n < 2) {
    toast("至少要 2 位選手先可以開始", "error");
    return;
  }
  const target = getTotalPlayers();
  if (n !== target) {
    if (
      !confirm(
        `設定目標係 ${target} 人，而家名單有 ${n} 人。\n以現有 ${n} 人開始？（單數該輪會有一人輪空）`
      )
    ) {
      return;
    }
    state.settings.playerCount = n;
    state.settings.playerPreset = PLAYER_PRESETS.includes(n) ? String(n) : "other";
  }
  const incomplete = state.players.filter((p) => !isDeckComplete(p));
  if (incomplete.length) {
    const names = incomplete
      .slice(0, 5)
      .map((p) => p.name)
      .join("、");
    const more = incomplete.length > 5 ? ` 等 ${incomplete.length} 人` : "";
    if (
      !confirm(
        `尚有 ${incomplete.length} 人未完成 3 隻陀螺登記（${names}${more}）。\n仍要開始比賽？（可稍後在選手頁補登）`
      )
    ) {
      return;
    }
  } else if (!confirm("確定開始比賽並產生第 1 輪配對？開始後不可刪除選手，但仍可加入遲到選手。")) {
    return;
  }

  state.phase = "swiss";
  state.currentRound = 1;
  state.rounds = [];
  const pairs = generateSwissPairings();
  state.rounds.push(createRoundFromPairs(pairs, 1));
  saveState({ backup: "開始比賽 · 第1輪" });
  render();
  switchTab("pairings");
  toast("第 1 輪配對已產生", "success");
}

// ─── Deck registration modal ─────────────────────────────
let deckEditPlayerId = null;
let deckEditBeyIndex = 0;
/** Working copy while modal open */
let deckDraft = null;
/** 三隻齊後顯示確認清單 */
let deckConfirmPending = false;
/** 切入 CX filter 前快照（未確認 CX 零件就切走可還原） */
let deckCxSnapshot = null;
/** Blade picker UI state：HOT | ALL | BX | UX | CX | OTHER */
let bladeSeriesFilter = "HOT";
let bladeSearchQuery = "";

function openDeckModal(playerId) {
  const p = playerById(playerId);
  if (!p) return;
  normalizePlayer(p);
  deckEditPlayerId = playerId;
  deckEditBeyIndex = 0;
  deckConfirmPending = false;
  deckCxSnapshot = null;
  deckDraft = p.beys.map((b) => normalizeBey(JSON.parse(JSON.stringify(b))));
  bladeSeriesFilter = "HOT";
  bladeSearchQuery = "";
  document.getElementById("deckModalTitle").textContent = "登記陀螺";
  renderDeckModal();
  document.getElementById("deckModal").classList.remove("hidden");
}

function closeDeckModal() {
  document.getElementById("deckModal").classList.add("hidden");
  deckEditPlayerId = null;
  deckDraft = null;
  deckConfirmPending = false;
  deckCxSnapshot = null;
}

function isCxBey(bey) {
  return !!(bey && (bey.series === "CX" || bey.bladeId === "cx"));
}

/**
 * 用戶真正開始揀 CX 零件時先轉成 CX（保留固鎖／軸心）
 * 切 filter 本身唔應呼叫呢個
 */
function ensureCx(bey) {
  if (!bey || isCxBey(bey)) return;
  if (!deckCxSnapshot) {
    deckCxSnapshot = JSON.parse(JSON.stringify(bey));
  }
  const keepRatchet = bey.ratchet || "";
  const keepBit = bey.bit || "";
  bey.bladeId = "cx";
  bey.series = "CX";
  bey.bladeCode = "";
  bey.bladeName = "";
  bey.bladeEn = "";
  bey.bladeCustom = "";
  Object.assign(bey, emptyCxParts());
  bey.cxType = "standard";
  bey.ratchet = keepRatchet;
  bey.bit = keepBit;
}

/** 離開 CX filter：若未完成 CX 組裝且有快照 → 還原 */
function restoreCxSnapshotIfNeeded(bey) {
  if (!bey || !deckCxSnapshot) return false;
  if (!isCxBey(bey)) {
    deckCxSnapshot = null;
    return false;
  }
  // 已完成 CX 上蓋組裝（未計固鎖軸心）→ 保留 CX，清快照
  if (isCxBladeComplete(bey)) {
    deckCxSnapshot = null;
    return false;
  }
  // 未完成：還原切入 CX 前嘅上蓋
  const snap = deckCxSnapshot;
  deckCxSnapshot = null;
  Object.keys(bey).forEach((k) => delete bey[k]);
  Object.assign(bey, snap);
  return true;
}

/**
 * 當前陀螺上蓋／固鎖／軸心齊 → 自動跳去下一隻未齊嘅陀螺
 * 三隻都齊 → 進入確認清單
 * @returns {boolean} 是否已切換
 */
function maybeAutoAdvanceDeckBey() {
  if (!deckDraft || !Array.isArray(deckDraft)) return false;
  const cur = deckDraft[deckEditBeyIndex];
  if (!cur || !isBeyComplete(cur)) return false;

  let next = -1;
  for (let i = deckEditBeyIndex + 1; i < deckDraft.length; i++) {
    if (!isBeyComplete(deckDraft[i])) {
      next = i;
      break;
    }
  }
  if (next < 0) {
    for (let i = 0; i < deckEditBeyIndex; i++) {
      if (!isBeyComplete(deckDraft[i])) {
        next = i;
        break;
      }
    }
  }

  if (next >= 0) {
    const from = deckEditBeyIndex + 1;
    deckEditBeyIndex = next;
    bladeSearchQuery = "";
    bladeSeriesFilter = "HOT";
    deckConfirmPending = false;
    toast(`陀螺 ${from} 已齊 ✓ → 請登記陀螺 ${next + 1}`, "success");
    return true;
  }

  if (deckDraft.every(isBeyComplete)) {
    deckConfirmPending = true;
  }
  return false;
}

/** 零件變更後：必要時自動跳下一隻，再重繪 modal */
function renderDeckModalAfterPartChange() {
  maybeAutoAdvanceDeckBey();
  // 改到未齊 3 隻 → 唔好留住確認框狀態
  if (deckDraft && !deckDraft.every(isBeyComplete)) {
    deckConfirmPending = false;
  }
  renderDeckModal();
}

function renderDeckConfirmPanel(p) {
  const lines = deckDraft
    .map((b, i) => {
      const short = beyLabel(b, { short: true });
      const full = beyLabel(b);
      return `<div class="deck-confirm-line">
        <span class="deck-confirm-num">陀螺 ${i + 1}</span>
        <div>
          <strong>${escapeHtml(short)}</strong>
          <div class="meta">${escapeHtml(full)}</div>
        </div>
      </div>`;
    })
    .join("");
  const warnings = checkDeckRestrictions({ beys: deckDraft });
  return `
    <div class="deck-confirm-panel">
      <div class="deck-confirm-head">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="church-tag ${p.church}">${churchLabel(p.church)}</span>
      </div>
      <p class="deck-confirm-q">請確認以下 3 隻陀螺登記是否正確：</p>
      <div class="deck-confirm-list">${lines}</div>
      ${
        warnings.length
          ? `<div class="deck-restrict-warn">⚠ ${warnings.map(escapeHtml).join("；")}</div>`
          : ""
      }
      <div class="btn-row wrap mt-16">
        <button type="button" class="btn btn-ghost" id="btnDeckConfirmEdit">需要更改</button>
        <button type="button" class="btn btn-primary" id="btnDeckConfirmOk" style="margin-left:auto">確定登記</button>
      </div>
    </div>
  `;
}

function renderDeckModal() {
  const p = playerById(deckEditPlayerId);
  if (!p || !deckDraft) return;
  const body = document.getElementById("deckModalBody");
  const bey = deckDraft[deckEditBeyIndex];
  const draftPlayer = { beys: deckDraft };
  const warnings = checkDeckRestrictions(draftPlayer);
  const completeCount = deckDraft.filter(isBeyComplete).length;

  // 三隻齊 → 確認畫面（唔使 scroll 揀零件）
  if (deckConfirmPending && completeCount === 3) {
    body.innerHTML = renderDeckConfirmPanel(p);
    document.getElementById("btnDeckConfirmOk")?.addEventListener("click", () => {
      saveDeckFromModal({ skipConfirmUi: true });
    });
    document.getElementById("btnDeckConfirmEdit")?.addEventListener("click", () => {
      deckConfirmPending = false;
      deckEditBeyIndex = 0;
      renderDeckModal();
      toast("可繼續修改，改完後會再確認", "success");
    });
    return;
  }

  const tabs = deckDraft
    .map((b, i) => {
      const done = isBeyComplete(b);
      return `<button type="button" class="bey-tab ${i === deckEditBeyIndex ? "active" : ""} ${done ? "done" : ""}" data-bey="${i}">
        陀螺 ${i + 1}${done ? " ✓" : ""}
      </button>`;
    })
    .join("");

  const shortCombo = beyLabel(bey, { short: true });
  const currentLine =
    shortCombo && shortCombo !== "（未登記）"
      ? escapeHtml(shortCombo)
      : "（未選）";

  // 例：1. UX15 1-70 LR  2. …  3. …
  const allLine = deckDraft
    .map((b, i) => {
      const s = beyLabel(b, { short: true });
      const text = s && s !== "（未登記）" ? s : "—";
      const done = isBeyComplete(b);
      return `<span class="deck-reg-item ${done ? "is-done" : ""}"><strong>${i + 1}.</strong> ${escapeHtml(text)}</span>`;
    })
    .join("<span class=\"deck-reg-sep\"> </span>");

  body.innerHTML = `
    <div class="deck-header-compact">
      <div class="deck-line-player">
        <strong class="deck-player-name">${escapeHtml(p.name)}</strong>
        <span class="church-tag ${p.church}">${churchLabel(p.church)}</span>
        <span class="deck-current-label">現時登記的陀螺：</span>
        <strong class="deck-current-combo">${currentLine}</strong>
      </div>
      <div class="deck-line-all">
        <span class="deck-reg-label">登記的陀螺：</span>${allLine}
      </div>
    </div>
    <div class="bey-tabs">${tabs}</div>
    ${
      warnings.length
        ? `<div class="deck-restrict-warn">⚠ 限制提示：${warnings.map(escapeHtml).join("；")}</div>`
        : ""
    }
    <div class="deck-parts-grid">
      <div class="deck-col deck-col-blade">
        ${renderBladePicker(bey)}
      </div>
      <div class="deck-col deck-col-ratchet">
        ${renderRatchetPicker(bey)}
      </div>
      <div class="deck-col deck-col-bit">
        ${renderBitPicker(bey)}
      </div>
    </div>
    <div class="btn-row wrap deck-footer-actions">
      <button type="button" class="btn btn-ghost btn-sm" id="btnClearBey">清空此陀螺</button>
      <button type="button" class="btn btn-secondary btn-sm" id="btnCopyBey" ${deckEditBeyIndex === 0 ? "disabled" : ""}>複製陀螺1</button>
      <button type="button" class="btn btn-primary btn-sm" id="btnSaveDeck" style="margin-left:auto">儲存</button>
    </div>
  `;

  bindDeckModalEvents(body);
}

function renderBladePicker(bey) {
  const seriesBtns = ["HOT", "ALL", "BX", "UX", "CX", "BXG", "OTHER"]
    .map((s) => {
      const label = SERIES_LABELS[s] || s;
      return `<button type="button" class="series-chip ${bladeSeriesFilter === s ? "active" : ""}" data-series="${s}">${label}</button>`;
    })
    .join("");

  // 選中顯示
  let selectedCompact = "";
  if (bey.series === "CX" || bey.bladeId === "cx") {
    selectedCompact = cxComboLabel(bey) || bey.cxProduct || "CX 組裝中";
  } else if (bey.bladeId && bey.bladeId !== "custom" && bey.bladeId !== "cx") {
    const selectedBlade = findBladeById(bey.bladeId);
    const hot = (PARTS.bladesHot || []).find((h) => h.bladeId === bey.bladeId);
    selectedCompact = hot
      ? hot.label
      : selectedBlade
        ? bladeStaffLabel(selectedBlade)
        : "";
  } else if (bey.bladeId === "custom") {
    selectedCompact = bey.bladeCustom || "自訂";
  }

  let bodyHtml = "";
  if (bladeSeriesFilter === "CX") {
    bodyHtml = renderCxAssembler(bey);
  } else if (bladeSeriesFilter === "HOT") {
    bodyHtml = renderHotBladePicker(bey);
  } else {
    bodyHtml = renderBxUxBladePicker(bey);
  }

  return `
    <div class="part-block">
      <h4>上蓋 Blade <span class="req">必選</span>
        ${selectedCompact ? `<span class="selected-compact">已選 <strong>${escapeHtml(selectedCompact)}</strong></span>` : ""}
      </h4>
      <div class="series-row">${seriesBtns}</div>
      ${bodyHtml}
    </div>
  `;
}

/** 熱門上蓋 checklist（預設） */
function renderHotBladePicker(bey) {
  const checkItems = (PARTS.bladesHot || [])
    .map((h) => {
      const blade = findBladeById(h.bladeId);
      if (!blade) return "";
      const sel = bey.bladeId === h.bladeId;
      return `
        <label class="blade-check-item ${sel ? "selected" : ""}">
          <input type="checkbox" class="blade-check-input" data-blade-id="${escapeAttr(h.bladeId)}"
            data-series="${escapeAttr(blade.series || "")}" ${sel ? "checked" : ""} />
          <span class="bci-code">${escapeHtml((h.label || "").split(" ")[0] || "")}</span>
          <span class="bci-name">${escapeHtml(h.label)}</span>
          ${
            blade.tier === "T0"
              ? '<span class="tier t0">T0</span>'
              : blade.tier === "T1"
                ? '<span class="tier t1">T1</span>'
                : ""
          }
        </label>`;
    })
    .join("");

  return `
    <div class="blade-check-wrap">
      <div class="blade-check-head">熱門上蓋 · 點選一項</div>
      <div class="blade-check-list" id="bladeOptionList">
        ${checkItems || '<div class="empty-mini">暫無熱門列表</div>'}
      </div>
      <div class="btn-row mt-8">
        <button type="button" class="btn btn-ghost btn-sm" id="btnBladeCustom">自由輸入…</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnGoCx">CX 組裝…</button>
        ${
          bey.bladeId === "custom"
            ? `<input class="input" id="bladeCustomInput" style="flex:1" placeholder="自訂上蓋名稱" value="${escapeAttr(bey.bladeCustom || "")}" />`
            : ""
        }
      </div>
    </div>
  `;
}

/** BX／UX／BXG／其他：checklist；全部：搜尋 + 全列表 */
function renderBxUxBladePicker(bey) {
  const seriesMode =
    bladeSeriesFilter === "BX" ||
    bladeSeriesFilter === "UX" ||
    bladeSeriesFilter === "BXG" ||
    bladeSeriesFilter === "OTHER";
  const list = filterBlades(
    bladeSeriesFilter === "ALL" ? "ALL" : bladeSeriesFilter,
    seriesMode ? "" : bladeSearchQuery
  );
  const exactHit =
    !seriesMode &&
    bladeSearchQuery.trim() &&
    list.length
      ? findBladeByQuery(bladeSearchQuery) || (list.length === 1 ? list[0] : null)
      : null;
  const canQuickConfirm =
    exactHit &&
    exactHit.series !== "CX" &&
    list.some((b) => b.id === exactHit.id || (exactHit.series === "CX" && b.compact === exactHit.compact));
  const cxHint = /^CX\d/i.test(normalizeCodeQuery(bladeSearchQuery));

  // 系列 checklist（checkbox 列表）
  if (seriesMode) {
    const checkItems = list
      .map((b) => {
        const sel = bey.bladeId === b.id;
        const compact =
          b.series === "OTHER" || b.code === "T0" || b.code === "T1"
            ? b.staffCode || b.name
            : bladeCompactCode(b);
        const tier =
          b.tier === "T0"
            ? '<span class="tier t0">T0</span>'
            : b.tier === "T1"
              ? '<span class="tier t1">T1</span>'
              : "";
        return `
          <label class="blade-check-item ${sel ? "selected" : ""}">
            <input type="checkbox" class="blade-check-input" data-blade-id="${escapeAttr(b.id)}"
              data-series="${escapeAttr(b.series)}" ${sel ? "checked" : ""} />
            <span class="bci-code">${escapeHtml(compact)}</span>
            <span class="bci-name">${escapeHtml(b.name)}</span>
            ${tier}
          </label>`;
      })
      .join("");

    const seriesName =
      bladeSeriesFilter === "BX"
        ? "BX 系列"
        : bladeSeriesFilter === "UX"
          ? "UX 系列"
          : bladeSeriesFilter === "BXG"
            ? "BXG／聯名"
            : "其他／限制系";

    return `
      <div class="blade-check-wrap">
        <div class="blade-check-head">${escapeHtml(seriesName)} · 點選一項</div>
        <div class="blade-check-list" id="bladeOptionList">
          ${checkItems || '<div class="empty-mini">此系列暫無上蓋</div>'}
        </div>
        <div class="btn-row mt-8">
          <button type="button" class="btn btn-ghost btn-sm" id="btnBladeCustom">自由輸入…</button>
          <button type="button" class="btn btn-secondary btn-sm" id="btnGoCx">CX 組裝…</button>
          ${
            bey.bladeId === "custom"
              ? `<input class="input" id="bladeCustomInput" style="flex:1" placeholder="自訂上蓋名稱" value="${escapeAttr(bey.bladeCustom || "")}" />`
              : ""
          }
        </div>
      </div>
    `;
  }

  // 「全部」：搜尋 + 列表
  const options = list
    .map((b) => {
      const sel = bey.bladeId === b.id || (b.series === "CX" && bey.cxProduct === b.compact);
      const compact = b.series === "CX" ? b.compact || bladeCompactCode(b) : bladeCompactCode(b);
      const tier =
        b.tier === "T0"
          ? '<span class="tier t0">T0</span>'
          : b.tier === "T1"
            ? '<span class="tier t1">T1</span>'
            : b.series === "CX"
              ? `<span class="tier ${b.cxType === "expand" ? "t0" : "t1"}">${b.cxType === "expand" ? "Expand" : "標準"}</span>`
              : "";
      return `<button type="button" class="blade-option ${sel ? "selected" : ""}" data-blade-id="${escapeAttr(b.id)}" data-series="${b.series}" data-compact="${escapeAttr(b.compact || "")}" data-cx-type="${escapeAttr(b.cxType || "")}">
        <span class="bo-code">${escapeHtml(compact)}</span>
        <span class="bo-name">${escapeHtml(b.name)}</span>
        <span class="bo-en">${escapeHtml(b.series)}</span>
        ${tier}
      </button>`;
    })
    .join("");

  return `
      <div class="blade-code-entry">
        <input class="input blade-search" id="bladeSearchInput" inputmode="text" autocomplete="off"
          placeholder="輸入 BX49 / UX15 / CX07 後 Enter"
          value="${escapeAttr(bladeSearchQuery)}" />
        ${
          canQuickConfirm && exactHit && exactHit.series !== "CX"
            ? `<button type="button" class="btn btn-primary" id="btnConfirmBlade">確認 ${escapeHtml(bladeCompactCode(exactHit))}</button>`
            : exactHit && exactHit.series === "CX"
              ? `<button type="button" class="btn btn-primary" id="btnConfirmBlade">確認 ${escapeHtml(exactHit.compact || "")}</button>`
              : ""
        }
      </div>
      <div class="hint" style="margin:6px 0">
        或撳上方系列睇 checklist · 打 <strong>BX49</strong> / <strong>UX15</strong> 亦可
        ${cxHint ? "（偵測到 CX，Enter 進入組裝）" : ""}
      </div>
      <div class="blade-option-list" id="bladeOptionList">
        ${options || '<div class="empty-mini">無符合結果</div>'}
      </div>
      <div class="btn-row mt-8">
        <button type="button" class="btn btn-ghost btn-sm" id="btnBladeCustom">自由輸入…</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnGoCx">CX 組裝…</button>
        ${
          bey.bladeId === "custom"
            ? `<input class="input" id="bladeCustomInput" style="flex:1" placeholder="自訂上蓋名稱" value="${escapeAttr(bey.bladeCustom || "")}" />`
            : ""
        }
      </div>
  `;
}

/**
 * CX 左欄組裝（純顯示，唔喺 render 寫 bey）
 * 順序：主要戰刃 → 超越（CX13+）→ 輔助 → 紋章
 */
function renderCxAssembler(bey) {
  const active = isCxBey(bey);
  // 顯示用副本：未轉 CX 前用空表單，唔改 deckDraft
  const cxType = active
    ? bey.cxType || resolveCxType(bey.cxProduct) || "standard"
    : "standard";
  const isExpand = cxType === "expand";
  const mainBlade = active ? bey.mainBlade || "" : "";
  const overBlade = active && isExpand ? bey.overBlade || "" : "";
  const assistBlade = active ? bey.assistBlade || "" : "";
  const lockChip = active ? bey.lockChip || "" : "";

  const typeToggle = `
    <div class="cx-type-toggle">
      <button type="button" class="chip ${!isExpand ? "selected" : ""}" data-cx-type-set="standard">
        <input type="checkbox" ${!isExpand ? "checked" : ""} tabindex="-1" />
        <span>標準（CX01–12）</span>
      </button>
      <button type="button" class="chip is-expand ${isExpand ? "selected" : ""}" data-cx-type-set="expand">
        <input type="checkbox" ${isExpand ? "checked" : ""} tabindex="-1" />
        <span>Expand（CX13 後）</span>
      </button>
    </div>`;

  const mainList = isExpand ? PARTS.cx.metalBlades : PARTS.cx.mainBlades;
  const mainChips = mainList
    .map(
      (c) =>
        `<button type="button" class="chip ${mainBlade === c.name ? "selected" : ""}" data-cx-main="${escapeAttr(c.name)}">
          <input type="checkbox" ${mainBlade === c.name ? "checked" : ""} tabindex="-1" />
          <span>${escapeHtml(c.name)}</span>
        </button>`
    )
    .join("");

  const overChips = PARTS.cx.overBlades
    .map(
      (o) =>
        `<button type="button" class="chip ${overBlade === o.code ? "selected" : ""}" data-cx-over="${o.code}">
          <input type="checkbox" ${overBlade === o.code ? "checked" : ""} tabindex="-1" />
          <span>${o.code}</span>
        </button>`
    )
    .join("");

  const assistChips = PARTS.cx.assistBlades
    .map(
      (a) =>
        `<button type="button" class="chip ${assistBlade === a.code ? "selected" : ""}" data-cx-assist="${a.code}">
          <input type="checkbox" ${assistBlade === a.code ? "checked" : ""} tabindex="-1" />
          <span>${a.code}</span>
        </button>`
    )
    .join("");

  const lockChips = PARTS.cx.lockChips
    .map(
      (c) =>
        `<button type="button" class="chip ${lockChip === c.name ? "selected" : ""}" data-cx-lock="${escapeAttr(c.name)}">
          <input type="checkbox" ${lockChip === c.name ? "checked" : ""} tabindex="-1" />
          <span>${escapeHtml(c.name)}</span>
        </button>`
    )
    .join("");

  const preview = active ? cxComboLabel(bey) || "（未完成）" : "（尚未開始 CX 組裝）";
  const complete = active && isCxBladeComplete(bey);

  return `
    <div class="cx-assembler cx-assembler-compact">
      ${
        !active
          ? `<div class="hint" style="margin:0 0 8px">揀下面任一零件開始 CX 組裝；未揀前唔會改到而家嘅上蓋。</div>`
          : ""
      }
      <div class="cx-field">
        <label>主要戰刃 <span class="req">必選</span></label>
        ${typeToggle}
        <div class="chip-grid chip-compact chip-row mt-8">${mainChips}</div>
      </div>

      ${
        isExpand
          ? `<div class="cx-field cx-over-required">
              <label>超越戰刃 <span class="req">只適用 CX13 後 · 必選</span></label>
              <div class="chip-grid chip-compact chip-row">${overChips}</div>
            </div>`
          : ""
      }

      <div class="cx-field">
        <label>輔助戰刃 <span class="req">必選</span></label>
        <div class="chip-grid chip-compact chip-row">${assistChips}</div>
      </div>

      <div class="cx-field">
        <label>紋章 <span class="req">必選</span></label>
        <div class="chip-grid chip-compact chip-row">${lockChips}</div>
      </div>

      <div class="cx-preview-mini">
        <strong>${escapeHtml(preview)}</strong>
        ${complete ? '<span class="ok">✓</span>' : '<span class="meta">未齊</span>'}
        <span class="meta">${isExpand ? "Expand（CX13+）" : "標準"}</span>
      </div>
    </div>
  `;
}

function selectBladeByStaffCode(query) {
  const list = filterBlades(bladeSeriesFilter === "CX" ? "ALL" : bladeSeriesFilter, query);
  let blade = findBladeByQuery(query);
  if (!blade && list.length === 1) blade = list[0];
  if (!blade) return false;

  // CX 產品 → 進入組裝
  if (blade.series === "CX" || (blade.compact && /^CX/i.test(blade.compact))) {
    const compact = blade.compact || normalizeCodeQuery(query);
    const bey = deckDraft[deckEditBeyIndex];
    applyCxProductToBey(bey, compact);
    bladeSeriesFilter = "CX";
    bladeSearchQuery = "";
    renderDeckModal();
    toast(`已選 ${compact}（${bey.cxType === "expand" ? "Expand" : "標準"}）— 請選紋章／主刃／輔助`, "success");
    return true;
  }

  deckCxSnapshot = null;
  applyBladeToBey(deckDraft[deckEditBeyIndex], blade);
  bladeSearchQuery = "";
  if (bladeSeriesFilter === "CX") bladeSeriesFilter = blade.series || "HOT";
  // 一體化固鎖 + 已有軸心時可能即齊 → 自動跳下一隻
  const label = bladeCompactCode(blade);
  if (isBeyComplete(deckDraft[deckEditBeyIndex])) {
    maybeAutoAdvanceDeckBey();
    renderDeckModal();
  } else {
    renderDeckModal();
    toast(`已選上蓋 ${label}`, "success");
  }
  return true;
}

function bindCxAssemblerEvents(body) {
  const bey = deckDraft[deckEditBeyIndex];
  if (!bey) return;

  // 標準 / Expand（CX13 後）→ 影響主刃列表同超越戰刃顯示
  body.querySelectorAll("[data-cx-type-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureCx(bey);
      const next = btn.dataset.cxTypeSet === "expand" ? "expand" : "standard";
      bey.cxType = next;
      if (next === "expand") {
        // 只喺用戶揀 Expand 時先寫產品預設（唔喺 render 寫）
        if (!bey.cxProduct || resolveCxType(bey.cxProduct) !== "expand") {
          bey.cxProduct = "CX13";
        }
      } else {
        bey.overBlade = "";
        if (bey.cxProduct && resolveCxType(bey.cxProduct) === "expand") {
          bey.cxProduct = "CX07";
        }
      }
      const list = next === "expand" ? PARTS.cx.metalBlades : PARTS.cx.mainBlades;
      if (bey.mainBlade && bey.mainBlade !== "__custom__" && !list.some((m) => m.name === bey.mainBlade)) {
        bey.mainBlade = "";
        bey.mainBladeCustom = "";
      }
      syncCxDisplayFields(bey);
      renderDeckModalAfterPartChange();
    });
  });

  // 1. 主要戰刃
  body.querySelectorAll("[data-cx-main]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureCx(bey);
      bey.mainBlade = btn.dataset.cxMain;
      bey.mainBladeCustom = "";
      syncCxDisplayFields(bey);
      renderDeckModalAfterPartChange();
    });
  });

  // 2. 超越戰刃（Expand only）
  body.querySelectorAll("[data-cx-over]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureCx(bey);
      bey.cxType = "expand";
      if (!bey.cxProduct || resolveCxType(bey.cxProduct) !== "expand") bey.cxProduct = "CX13";
      const c = btn.dataset.cxOver;
      bey.overBlade = bey.overBlade === c ? "" : c;
      syncCxDisplayFields(bey);
      renderDeckModalAfterPartChange();
    });
  });

  // 3. 輔助戰刃
  body.querySelectorAll("[data-cx-assist]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureCx(bey);
      const c = btn.dataset.cxAssist;
      bey.assistBlade = bey.assistBlade === c ? "" : c;
      syncCxDisplayFields(bey);
      renderDeckModalAfterPartChange();
    });
  });

  // 4. 紋章
  body.querySelectorAll("[data-cx-lock]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureCx(bey);
      bey.lockChip = btn.dataset.cxLock;
      bey.lockChipCustom = "";
      syncCxDisplayFields(bey);
      renderDeckModalAfterPartChange();
    });
  });
}

/**
 * 零件 chip 按「系」分行（唔顯示系名，慳位）
 * @param {object} [opts] labelMap: { code: displayLabel }
 */
function renderSeriesChipRows(rows, selected, dataAttr, opts = {}) {
  const labelMap = opts.labelMap || {};
  return (rows || [])
    .map((row) => {
      const chips = (row.items || [])
        .map((code) => {
          const sel = selected === code;
          const lab = labelMap[code] || code;
          return `<button type="button" class="chip ${sel ? "selected" : ""}" data-${dataAttr}="${escapeAttr(code)}">
            <input type="checkbox" ${sel ? "checked" : ""} tabindex="-1" />
            <span>${escapeHtml(lab)}</span>
          </button>`;
        })
        .join("");
      if (!chips) return "";
      return `
        <div class="part-series-row">
          <div class="chip-grid chip-compact chip-row">${chips}</div>
        </div>`;
    })
    .join("");
}

/** 由完整固鎖表自動按系分行（確保全部顯示） */
function buildAllRatchetSeriesRows() {
  const allRatchets = PARTS.ratchets.includes("簡易固鎖")
    ? [...PARTS.ratchets]
    : [...PARTS.ratchets, "簡易固鎖"];
  const allSet = new Set(allRatchets);

  // 優先用預設分組，再補漏網之魚
  const rows = (PARTS.ratchetsBySeries || []).map((row) => ({
    label: row.label,
    items: (row.items || []).filter((r) => allSet.has(r)),
  }));
  const covered = new Set(rows.flatMap((r) => r.items));
  const leftover = allRatchets.filter((r) => !covered.has(r));
  if (leftover.length) {
    // 按前綴再分：1-xx → 1 組
    const byPrefix = {};
    leftover.forEach((r) => {
      const m = String(r).match(/^([0-9M]+)/i);
      const key = m ? m[1] : "其他";
      (byPrefix[key] ||= []).push(r);
    });
    Object.keys(byPrefix)
      .sort()
      .forEach((key) => {
        const existing = rows.find((r) => r.label === key);
        if (existing) existing.items.push(...byPrefix[key]);
        else rows.push({ label: key, items: byPrefix[key] });
      });
  }
  return rows.filter((r) => r.items.length);
}

function renderRatchetPicker(bey) {
  // UX-19／20／21：新 UX 一體化固鎖，無需登記
  if (beyHasIntegratedRatchet(bey)) {
    if (bey.ratchet !== INTEGRATED_RATCHET_LABEL) {
      bey.ratchet = INTEGRATED_RATCHET_LABEL;
    }
    return `
      <div class="part-block">
        <h4>固鎖</h4>
        <div class="deck-restrict-ok" style="margin:0">✓ 一體化固鎖（免選）</div>
      </div>
    `;
  }

  const seriesRows = buildAllRatchetSeriesRows();
  // 簡易固鎖顯示短名
  const displayRows = seriesRows.map((row) => ({
    ...row,
    items: row.items,
    _labels: Object.fromEntries(
      row.items.map((r) => [r, r === "簡易固鎖" ? "簡易" : r])
    ),
  }));

  return `
    <div class="part-block part-block-ratchet-all">
      <h4>固鎖 <span class="req">必選</span></h4>
      <div class="part-series-list part-series-list-all">
        ${renderSeriesChipRows(displayRows, bey.ratchet, "quick-ratchet", {
          labelMap: Object.assign({}, ...displayRows.map((r) => r._labels)),
        })}
      </div>
    </div>
  `;
}

function renderBitPicker(bey) {
  const { freq, rest } = sortedBits();
  const current = normalizeBitCode(bey.bit || "");
  if (bey.bit && bey.bit !== current) bey.bit = current;

  const validBits = new Set(
    (PARTS.bits || []).map((c) => normalizeBitCode(c)).filter(Boolean)
  );

  const seriesRows = (PARTS.bitsBySeries || []).map((row) => ({
    label: row.label,
    items: (row.items || [])
      .map((c) => normalizeBitCode(c))
      .filter((c) => validBits.has(c) || (PARTS.bits || []).includes(c)),
  }));

  // 確保 W 等自訂分組代碼可選（若已加入 bits）
  seriesRows.forEach((row) => {
    row.items = [...new Set(row.items.filter(Boolean))];
  });

  const optGroup = (label, codes) =>
    `<optgroup label="${label}">${codes
      .map((c) => `<option value="${c}" ${current === c ? "selected" : ""}>${c}</option>`)
      .join("")}</optgroup>`;

  return `
    <div class="part-block">
      <h4>軸心 Bit <span class="req">必選</span></h4>
      <div class="part-series-list">
        ${renderSeriesChipRows(seriesRows, current, "quick-bit")}
      </div>
      <select class="input select part-select part-select-compact" id="bitSelect">
        <option value="">— 其他 —</option>
        ${optGroup("常用", freq)}
        ${optGroup("全部", rest)}
      </select>
    </div>
  `;
}

function bindDeckModalEvents(body) {
  body.querySelectorAll(".bey-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      deckEditBeyIndex = Number(btn.dataset.bey);
      bladeSearchQuery = "";
      renderDeckModal();
    });
  });

  body.querySelectorAll(".series-chip[data-series]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.series;
      const bey = deckDraft[deckEditBeyIndex];
      const leavingCx = bladeSeriesFilter === "CX" && next !== "CX";
      const enteringCx = next === "CX" && bladeSeriesFilter !== "CX";

      // 離開 CX 且未完成組裝 → 還原切入前上蓋
      if (leavingCx && bey) {
        if (restoreCxSnapshotIfNeeded(bey)) {
          toast("已還原切入 CX 前嘅上蓋（CX 組裝未完成）", "success");
        }
      }

      bladeSeriesFilter = next;
      bladeSearchQuery = "";

      // 切入 CX：只改 filter，唔改 bey；提示新流程
      if (enteringCx) {
        // 若而家唔係 CX，預先影相（真正轉 CX 喺揀零件時）
        if (bey && !isCxBey(bey) && !deckCxSnapshot) {
          deckCxSnapshot = JSON.parse(JSON.stringify(bey));
        }
        toast("請依序：主要戰刃 →（Expand 先選超越）→ 輔助戰刃 → 紋章", "success");
      }
      renderDeckModal();
    });
  });

  // CX 組裝事件（只喺 CX filter 綁定）
  if (bladeSeriesFilter === "CX") {
    bindCxAssemblerEvents(body);
  }

  const search = body.querySelector("#bladeSearchInput");
  if (search) {
    search.addEventListener("input", () => {
      bladeSearchQuery = search.value;
      const pos = search.selectionStart;
      renderDeckModal();
      const again = document.getElementById("bladeSearchInput");
      if (again) {
        again.focus();
        try {
          again.setSelectionRange(pos, pos);
        } catch (_) {}
      }
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = search.value.trim();
        if (!q) return;
        if (!selectBladeByStaffCode(q)) {
          toast("搵唔到呢個編號，請用 BX49 / UX15 / CX07 格式", "error");
        }
      }
    });
  }

  document.getElementById("btnConfirmBlade")?.addEventListener("click", () => {
    const q = bladeSearchQuery.trim();
    if (!selectBladeByStaffCode(q)) toast("搵唔到呢個編號", "error");
  });

  const pickBlade = (blade) => {
    if (!blade) return;
    deckCxSnapshot = null; // 已揀非 CX 上蓋，取消還原快照
    applyBladeToBey(deckDraft[deckEditBeyIndex], blade);
    bladeSearchQuery = "";
    // 揀完上蓋後保持而家 filter（熱門／全部／系列），唔自動跳走
    if (isBeyComplete(deckDraft[deckEditBeyIndex])) {
      maybeAutoAdvanceDeckBey();
      renderDeckModal();
    } else {
      renderDeckModal();
      const hot = (PARTS.bladesHot || []).find((h) => h.bladeId === blade.id);
      toast(`已選上蓋 ${hot ? hot.label : bladeStaffLabel(blade) || bladeCompactCode(blade)}`, "success");
    }
  };

  // 系列 checklist（單選：勾一項即選）
  body.querySelectorAll(".blade-check-input").forEach((inp) => {
    inp.addEventListener("change", () => {
      if (!inp.checked) {
        // 唔允許清空：保持選中
        inp.checked = true;
        return;
      }
      pickBlade(findBladeById(inp.dataset.bladeId));
    });
  });
  body.querySelectorAll(".blade-check-item").forEach((lab) => {
    lab.addEventListener("click", (e) => {
      if (e.target.closest("input")) return;
      const inp = lab.querySelector(".blade-check-input");
      if (!inp) return;
      pickBlade(findBladeById(inp.dataset.bladeId));
    });
  });

  body.querySelectorAll(".blade-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.series === "CX" || (btn.dataset.compact || "").startsWith("CX")) {
        const compact = btn.dataset.compact || btn.dataset.bladeId;
        applyCxProductToBey(deckDraft[deckEditBeyIndex], compact);
        bladeSeriesFilter = "CX";
        bladeSearchQuery = "";
        renderDeckModal();
        toast(`已選 ${normalizeCodeQuery(compact)} — 請完成 CX 組件`, "success");
        return;
      }
      pickBlade(findBladeById(btn.dataset.bladeId));
    });
  });

  document.getElementById("btnGoCx")?.addEventListener("click", () => {
    const bey = deckDraft[deckEditBeyIndex];
    if (bey && !isCxBey(bey) && !deckCxSnapshot) {
      deckCxSnapshot = JSON.parse(JSON.stringify(bey));
    }
    bladeSeriesFilter = "CX";
    // 唔即刻轉 bey；等用戶揀 CX 零件
    toast("請依序：主要戰刃 →（Expand 先選超越）→ 輔助戰刃 → 紋章", "success");
    renderDeckModal();
  });

  document.getElementById("btnBladeCustom")?.addEventListener("click", () => {
    const bey = deckDraft[deckEditBeyIndex];
    deckCxSnapshot = null; // 人手改自訂上蓋，取消 CX 還原
    Object.assign(bey, emptyCxParts());
    bey.bladeId = "custom";
    bey.series = "OTHER";
    bey.bladeCode = "";
    bey.bladeEn = "";
    bey.bladeName = bey.bladeCustom || "";
    renderDeckModal();
    document.getElementById("bladeCustomInput")?.focus();
  });

  document.getElementById("bladeCustomInput")?.addEventListener("input", (e) => {
    const bey = deckDraft[deckEditBeyIndex];
    bey.bladeId = "custom";
    bey.bladeCustom = e.target.value;
    bey.bladeName = e.target.value;
    if (!bey.series) bey.series = bladeSeriesFilter === "CX" ? "CX" : "OTHER";
    const cur = body.querySelector(".deck-current-combo");
    if (cur) cur.textContent = beyLabel(bey, { short: true });
  });

  document.getElementById("ratchetSelect")?.addEventListener("change", (e) => {
    deckDraft[deckEditBeyIndex].ratchet = e.target.value;
    renderDeckModalAfterPartChange();
  });
  document.getElementById("bitSelect")?.addEventListener("change", (e) => {
    deckDraft[deckEditBeyIndex].bit = normalizeBitCode(e.target.value);
    renderDeckModalAfterPartChange();
  });

  body.querySelectorAll("[data-quick-ratchet]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.quickRatchet;
      const bey = deckDraft[deckEditBeyIndex];
      bey.ratchet = bey.ratchet === v ? "" : v;
      renderDeckModalAfterPartChange();
    });
  });
  body.querySelectorAll("[data-quick-bit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = normalizeBitCode(btn.dataset.quickBit);
      const bey = deckDraft[deckEditBeyIndex];
      bey.bit = bey.bit === v ? "" : v;
      renderDeckModalAfterPartChange();
    });
  });

  document.getElementById("btnClearBey")?.addEventListener("click", () => {
    deckDraft[deckEditBeyIndex] = emptyBey();
    bladeSearchQuery = "";
    renderDeckModal();
  });
  document.getElementById("btnCopyBey")?.addEventListener("click", () => {
    deckDraft[deckEditBeyIndex] = normalizeBey(JSON.parse(JSON.stringify(deckDraft[0])));
    // 複製後若齊備 → 自動跳下一隻
    renderDeckModalAfterPartChange();
  });
  document.getElementById("btnSaveDeck")?.addEventListener("click", saveDeckFromModal);
}

function saveDeckFromModal(opts = {}) {
  const p = playerById(deckEditPlayerId);
  if (!p || !deckDraft) return;

  // 未齊 3 隻時：若撳儲存且已齊 → 先入確認畫面
  if (!opts.skipConfirmUi && deckDraft.every(isBeyComplete) && !deckConfirmPending) {
    deckConfirmPending = true;
    renderDeckModal();
    return;
  }

  for (let i = 0; i < 3; i++) {
    const b = deckDraft[i];
    const hasParts = b.ratchet || b.bit || partDisplayBlade(b) || b.lockChip || b.mainBlade;

    // CX 完整度檢查
    if (b.series === "CX" || b.bladeId === "cx") {
      if (hasParts && !isCxBladeComplete(b)) {
        deckConfirmPending = false;
        deckEditBeyIndex = i;
        bladeSeriesFilter = "CX";
        renderDeckModal();
        const type = b.cxType || "standard";
        if (type === "expand" && !(b.overBlade || "").trim()) {
          toast(`陀螺 ${i + 1}：Expand CX 必須選擇超越戰刃`, "error");
        } else {
          toast(`陀螺 ${i + 1}：CX 請完成紋章 + 主刃 + 輔助戰刃`, "error");
        }
        return;
      }
      syncCxDisplayFields(b);
      continue;
    }

    if (b.bladeId === "custom" && hasParts && !(b.bladeCustom || b.bladeName || "").trim()) {
      deckConfirmPending = false;
      deckEditBeyIndex = i;
      renderDeckModal();
      toast(`陀螺 ${i + 1}：請填寫上蓋名稱`, "error");
      return;
    }
  }

  const warnings = checkDeckRestrictions({ beys: deckDraft });
  if (warnings.length) {
    if (!confirm("檢測到限制提示：\n· " + warnings.join("\n· ") + "\n\n仍要儲存？")) return;
  }

  p.beys = deckDraft.map((b) => normalizeBey(JSON.parse(JSON.stringify(b))));
  p.deckChecked = isDeckComplete(p);
  saveState();
  closeDeckModal();
  render();
  toast(
    p.deckChecked ? `${p.name} 陀螺登記完成（3/3）` : `${p.name} 已儲存（完成 ${deckProgress(p)}/3）`,
    "success"
  );
}

function regeneratePairing() {
  const round = currentRoundObj();
  if (!round || round.locked) {
    toast("本輪已鎖定，無法重新配對", "error");
    return;
  }
  if (round.matches.some(hasRealSwissResult)) {
    if (!confirm("本輪已有比賽結果，重新配對會清除本輪結果。確定？")) return;
  }
  // Remove current unlocked round and regenerate
  state.rounds = state.rounds.filter((r) => r.round !== round.round);
  const pairs = generateSwissPairings();
  state.rounds.push(createRoundFromPairs(pairs, state.currentRound));
  state.rounds.sort((a, b) => a.round - b.round);
  saveState();
  render();
  toast("已重新產生配對", "success");
}

function currentRoundObj() {
  return state.rounds.find((r) => r.round === state.currentRound);
}

function saveMatchResult(matchId, winnerId, p1Bp, p2Bp) {
  const found = findMatchById(matchId);
  if (!found) return false;
  const { match: m, round, playoff } = found;
  if (!playoff && (!round || round.locked)) {
    toast("本輪已鎖定", "error");
    return false;
  }
  if (isByeMatch(m)) {
    toast("自動獲勝場無需輸入結果", "error");
    return false;
  }
  if (m.lateForfeit) {
    toast("遲到對戰已自動 0–4，無需輸入結果", "error");
    return false;
  }

  // 若有 battle 明細，以 battles 為準（強制完場必須經 resolveForceWinner，同分唔靜默）
  if (Array.isArray(m.battles) && m.battles.length > 0) {
    applyBattleTotals(m);
    if (!m.done) {
      toast(`尚未有一方達到 ${MATCH_TARGET} 分，請用 Battle 紀錄完場（或強制完場）`, "error");
      return false;
    }
    if (playoff && !m.winner) {
      m.done = false;
      m.draw = false;
      toast("入圍加賽必須分出勝方：繼續打到一方先到 4 分（唔可以無分完場）", "error");
      return false;
    }
    if (playoff) maybeAdvanceCutPlayoff();
    saveState();
    render();
    toast("結果已儲存", "success");
    return true;
  }

  p1Bp = Math.max(0, parseInt(p1Bp, 10) || 0);
  p2Bp = Math.max(0, parseInt(p2Bp, 10) || 0);
  const auto = autoWinnerFromScores(m.p1, m.p2, p1Bp, p2Bp);
  if (auto) winnerId = auto;
  const isDraw = p1Bp === p2Bp;
  if (isDraw) {
    if (playoff) {
      toast("入圍加賽必須分出勝方：繼續打到一方先到 4 分（唔可以無分完場）", "error");
      return false;
    }
    if (p1Bp < MATCH_TARGET) {
      if (!confirm(`雙方均未達 ${MATCH_TARGET} 分（${p1Bp}:${p2Bp}）。記作無分完場？`)) return false;
    }
    m.winner = null;
    m.draw = true;
    m.p1Bp = p1Bp;
    m.p2Bp = p2Bp;
    m.done = true;
    saveState();
    render();
    toast("已記無分（兩邊都唔計瑞士勝）", "success");
    return true;
  }
  if (winnerId !== m.p1 && winnerId !== m.p2) {
    toast(`請輸入先到 ${MATCH_TARGET} 分嘅結果`, "error");
    return false;
  }
  const winBp = winnerId === m.p1 ? p1Bp : p2Bp;
  if (winBp < MATCH_TARGET) {
    if (!confirm(`勝方比賽分（${winBp}）未達 ${MATCH_TARGET}，仍要儲存？`)) return false;
  }
  m.winner = winnerId;
  m.draw = false;
  m.p1Bp = p1Bp;
  m.p2Bp = p2Bp;
  m.done = true;
  if (playoff) maybeAdvanceCutPlayoff();
  saveState();
  render();
  toast("結果已儲存", "success");
  return true;
}

function clearMatchResult(matchId) {
  const found = findMatchById(matchId);
  if (!found) return;
  const { match: m, round, playoff } = found;
  if (!playoff && (!round || round.locked)) return;
  if (m.lateForfeit) {
    toast("遲到自動 0–4 唔好手動清除；可改遲到標記或重新配對", "error");
    return;
  }
  m.winner = null;
  m.p1Bp = 0;
  m.p2Bp = 0;
  m.done = false;
  m.draw = false;
  m.battles = emptyBattles();
  saveState();
  render();
}

/** 儲存瑞士制 Match 的 battle 列表並完場（如已達 4 分） */
async function commitMatchBattles(matchId, battles, forceComplete) {
  const found = findMatchById(matchId);
  if (!found) return false;
  const { match: m, round, playoff } = found;
  if (!playoff && (!round || round.locked)) {
    toast("本輪已鎖定", "error");
    return false;
  }
  m.battles = normalizeBattles(battles);
  applyBattleTotals(m);
  if (!m.done && forceComplete) {
    const t = totalsFromBattles(m.p1, m.p2, m.battles);
    if (t.p1Bp === 0 && t.p2Bp === 0 && !(m.battles || []).length) {
      toast("請至少記錄一場 Battle", "error");
      return false;
    }
    if (!confirm(`尚未有一方 ≥ ${MATCH_TARGET} 分（${t.p1Bp}:${t.p2Bp}）。強制結束？平手會記無分。`)) {
      return false;
    }
    m.p1Bp = t.p1Bp;
    m.p2Bp = t.p2Bp;
    const w = await resolveForceWinner(m.p1, m.p2, t.p1Bp, t.p2Bp);
    m.winner = w;
    m.draw = !w;
    m.done = true;
  }
  if (!m.done) {
    saveState();
    render();
    toast(`已儲存 Battle 紀錄（目前 ${m.p1Bp} : ${m.p2Bp}，未完場）`, "success");
    return true;
  }
  if (playoff && !m.winner) {
    m.done = false;
    m.draw = false;
    toast("入圍加賽必須分出勝方：繼續打到一方先到 4 分（唔可以無分完場）", "error");
    return false;
  }
  if (playoff) maybeAdvanceCutPlayoff();
  saveState();
  render();
  toast("Match 完場，結果已儲存", "success");
  return true;
}

function lockRoundAndAdvance() {
  if (!assertCanWrite()) return;
  const round = currentRoundObj();
  if (!round) return;
  if (!round.matches.every((m) => m.done)) {
    toast("請先完成所有比賽結果", "error");
    return;
  }
  if (round.locked) return;

  const isLast = state.currentRound >= getSwissRounds();
  const koN = getKoBracketSize();
  const msg = isLast
    ? `鎖定第 ${state.currentRound} 輪（共 ${getSwissRounds()} 輪）並結算排名？前 ${koN} 名將可晉級淘汰賽。`
    : `鎖定第 ${state.currentRound} 輪並產生第 ${state.currentRound + 1} 輪配對？`;
  if (!confirm(msg)) return;

  round.locked = true;

  if (isLast) {
    state.phase = "knockout";
    saveState({ backup: `鎖定瑞士第 ${state.currentRound} 輪（完）` });
    render();
    switchTab("standings");
    toast(`瑞士制結束！請查看前 ${koN} 名`, "success");
    return;
  }

  state.currentRound += 1;
  const pairs = generateSwissPairings();
  state.rounds.push(createRoundFromPairs(pairs, state.currentRound));
  saveState({ backup: `鎖定第 ${state.currentRound - 1} 輪` });
  render();
  toast(`第 ${state.currentRound} 輪配對已產生`, "success");
}

function applyManualPairings(pairIds) {
  // pairIds: [[p1,p2], ...]
  const round = currentRoundObj();
  if (!round || round.locked) {
    toast("無法調整", "error");
    return;
  }
  if (round.matches.some(hasRealSwissResult)) {
    if (!confirm("本輪已有結果，手動調整會清除。確定？")) return;
  }
  const all = pairIds.flat().filter(Boolean);
  const need = getPairingPlayerCount();
  if (new Set(all).size !== need || all.length !== need) {
    toast(`請確保 ${need} 位選手恰好各出現一次（單數可一人坐場）`, "error");
    return;
  }
  round.matches = assignMatchZones(
    pairIds.map((pair, i) => {
      const p1 = pair[0];
      const p2 = pair[1] || null;
      const bye = !p2;
      const m = {
        id: uid("m"),
        table: i + 1,
        p1,
        p2,
        bye,
        winner: bye ? p1 : null,
        p1Bp: 0,
        p2Bp: 0,
        done: bye,
        p1BeyOrder: emptyBeyOrder(),
        p2BeyOrder: emptyBeyOrder(),
        battles: emptyBattles(),
      };
      if (bye) applyLateSitLossIfNeeded(m);
      else applyLateForfeitIfNeeded(m);
      return m;
    })
  );
  saveState();
  closeManualModal();
  render();
  toast("配對已更新", "success");
}

// Knockout
function getKoMatch(matchRef) {
  if (!state.knockout || !matchRef) return null;
  if (matchRef.type === "third") return state.knockout.third;
  if (matchRef.type === "final") return state.knockout.final;
  if (matchRef.type === "semi") {
    if (state.knockout.semis) return state.knockout.semis[matchRef.index];
    const last = state.knockout.rounds?.[state.knockout.rounds.length - 1];
    return last?.matches?.[matchRef.index];
  }
  if (matchRef.type === "round") {
    return state.knockout.rounds?.[matchRef.roundIndex]?.matches?.[matchRef.matchIndex];
  }
  return null;
}

/** 實際淘汰規模（已產生 bracket 時以 bracket 為準） */
function getEffectiveKoSize() {
  if (state.knockout?.bracketSize) return state.knockout.bracketSize;
  return getKoBracketSize();
}

function swissReadyForKnockout() {
  return (
    state.rounds.length >= getSwissRounds() &&
    state.rounds.length > 0 &&
    state.rounds.every((r) => r.locked) &&
    state.rounds.filter((r) => r.locked).length >= getSwissRounds()
  );
}

/** 改早期場次時：清掉下游輪／決賽／季軍，之後重新晉級 */
function invalidateKnockoutAfter(roundIndex) {
  const ko = state.knockout;
  if (!ko?.rounds) return;
  const ri = Math.max(0, roundIndex);
  ko.rounds = ko.rounds.slice(0, ri + 1);
  ko.final = null;
  ko.third = null;
  const adv = { ...(ko._advancedFrom || {}) };
  Object.keys(adv).forEach((k) => {
    if (Number(k) >= ri) delete adv[k];
  });
  ko._advancedFrom = adv;
  if (state.phase === "done") state.phase = "knockout";
}

function koMatchHasDownstream(matchRef) {
  const ko = state.knockout;
  if (!ko) return false;
  if (matchRef.type === "final" || matchRef.type === "third") return false;
  let ri = null;
  if (matchRef.type === "round") ri = matchRef.roundIndex;
  else if (matchRef.type === "semi") ri = (ko.rounds?.length || 1) - 1;
  if (ri == null || ri < 0) return false;
  if ((ko.rounds?.length || 0) > ri + 1) return true;
  if (ko.final || ko.third) return true;
  if (ko._advancedFrom?.[ri]) return true;
  return false;
}

function startKnockout() {
  if (!assertCanWrite()) return;
  if (!ensureQualifyEngineForAction("產生淘汰賽")) return;
  const need = getSwissRounds();
  const relevant = state.rounds.filter((r) => r.round <= need);
  const okSwiss = relevant.length >= need && relevant.every((r) => r.locked);
  if (!okSwiss) {
    const lockedN = state.rounds.filter((r) => r.locked).length;
    toast(`請先完成 ${need} 輪瑞士制（已鎖定 ${lockedN} 輪）`, "error");
    return;
  }
  if (state.knockout) {
    toast("淘汰賽已產生。若要重做請按「重做淘汰賽」", "error");
    return;
  }

  const koN = getKoBracketSize();
  const ranked = rankedPlayers();
  if (ranked.length < koN) {
    toast(`選手不足 ${koN} 人，無法產生 ${koN} 強`, "error");
    return;
  }

  const ctx = getCutoffContext();
  const plan = describeCutoffPlan(ctx);
  if (ctx.needed && plan.needsMatches && !cutPlayoffComplete()) {
    toast("入圍邊界同分，請先完成加賽（同分頁）", "error");
    switchTab("ties");
    return;
  }

  const seedList = cutoffSeedList();
  if (!seedList || seedList.length < koN) {
    toast("入圍名單未齊，請完成加賽或檢查排名", "error");
    switchTab("ties");
    return;
  }

  const order = seededBracketOrder(koN);
  if (!order.length) {
    toast("淘汰規模無效", "error");
    return;
  }
  const matches = [];
  for (let i = 0; i < order.length; i += 2) {
    const s1 = order[i];
    const s2 = order[i + 1];
    const p1 = seedList[s1 - 1];
    const p2 = seedList[s2 - 1];
    matches.push(makeKoMatch(`${koRoundLabel(koN)} · 第${s1} vs 第${s2}`, p1.id, p2.id));
  }

  state.phase = "knockout";
  state.knockout = {
    bracketSize: koN,
    rounds: [{ name: koRoundLabel(koN), matches }],
    third: null,
    final: null,
    _advancedFrom: {},
  };
  saveState({ backup: `產生${koN}強淘汰賽` });
  render();
  switchTab("knockout");
  const pairHint = matches.map((m) => m.label.replace(koRoundLabel(koN) + " · ", "")).join("、");
  toast(`${koN} 強已產生：${pairHint}`, "success");
}

/** 清除淘汰賽 bracket，保留瑞士制（可按新設定重產） */
function redoKnockout() {
  if (!state.knockout) {
    toast("尚未有淘汰賽", "error");
    return;
  }
  if (
    !confirm(
      "清除現有淘汰賽 bracket（準決賽／決賽等）？\n瑞士制成績會保留，之後可按目前設定重新產生。"
    )
  ) {
    return;
  }
  pushAutoBackup("重做淘汰賽前");
  state.knockout = null;
  const locked = state.rounds.filter((r) => r.locked).length;
  state.phase = locked >= getSwissRounds() ? "knockout" : "swiss";
  if (state.phase === "done") state.phase = "knockout";
  saveState({ backup: "已清除淘汰賽" });
  render();
  toast("已清除淘汰賽，可重新產生", "success");
}

/**
 * 當前輪完場後晉級：>2 場 → 下一輪；2 場 → 決賽+季軍
 * @returns {boolean} 是否剛產生新輪／決賽
 */
function tryAdvanceKnockout() {
  const ko = state.knockout;
  if (!ko?.rounds?.length) return false;
  const ri = ko.rounds.length - 1;
  const last = ko.rounds[ri];
  if (!last.matches.every((m) => m.done && m.winner)) return false;
  if (ko._advancedFrom?.[ri]) return false;

  if (last.matches.length === 2) {
    if (!ko.final) {
      const [m0, m1] = last.matches;
      const w1 = m0.winner;
      const w2 = m1.winner;
      const l1 = m0.p1 === w1 ? m0.p2 : m0.p1;
      const l2 = m1.p1 === w2 ? m1.p2 : m1.p1;
      ko.final = makeKoMatch("決賽", w1, w2);
      ko.third = makeKoMatch("季軍賽", l1, l2);
      ko._advancedFrom = { ...(ko._advancedFrom || {}), [ri]: true };
      return true;
    }
    return false;
  }

  if (last.matches.length > 2 && last.matches.length % 2 === 0) {
    const nextPlayerCount = last.matches.length;
    const name = koRoundLabel(nextPlayerCount);
    const nextMatches = [];
    for (let i = 0; i < last.matches.length; i += 2) {
      const a = last.matches[i].winner;
      const b = last.matches[i + 1].winner;
      nextMatches.push(makeKoMatch(`${name} · 場 ${nextMatches.length + 1}`, a, b));
    }
    ko.rounds.push({ name, matches: nextMatches });
    ko._advancedFrom = { ...(ko._advancedFrom || {}), [ri]: true };
    return true;
  }
  return false;
}

function saveKoResult(matchRef, winnerId, p1Bp, p2Bp) {
  const m = getKoMatch(matchRef);
  if (!m) return false;

  p1Bp = Math.max(0, parseInt(p1Bp, 10) || 0);
  p2Bp = Math.max(0, parseInt(p2Bp, 10) || 0);
  const auto = autoWinnerFromScores(m.p1, m.p2, p1Bp, p2Bp);
  if (auto) winnerId = auto;
  if (!winnerId || (winnerId !== m.p1 && winnerId !== m.p2)) {
    toast("請選擇勝方", "error");
    return false;
  }

  // 修改已晉級場次 → 確認後清下游再重建
  if (koMatchHasDownstream(matchRef)) {
    if (
      !confirm(
        "修改此場會清除之後輪次／決賽／季軍賽結果，並按新勝方重新晉級。確定？"
      )
    ) {
      return false;
    }
    let ri = matchRef.type === "round" ? matchRef.roundIndex : null;
    if (matchRef.type === "semi") ri = (state.knockout.rounds?.length || 1) - 1;
    if (ri != null) invalidateKnockoutAfter(ri);
  }

  m.winner = winnerId;
  m.p1Bp = p1Bp;
  m.p2Bp = p2Bp;
  m.done = true;

  const advanced = tryAdvanceKnockout();

  if (state.knockout.final?.done && state.knockout.third?.done) {
    state.phase = "done";
  } else {
    state.phase = "knockout";
  }

  // 只在晉級（新一輪／決賽產生）時 full backup，唔好每場都 snapshot
  saveState(advanced ? { backup: "淘汰賽晉級" } : {});
  render();
  toast(advanced ? "結果已儲存，已產生下一輪／決賽" : "淘汰賽結果已儲存", "success");
  return true;
}

function resetAll() {
  const inCloud = !!window.BaoluoSync?.getRoomId?.();
  const msg = inCloud
    ? "確定清除全部資料？\n會離開而家呢場雲端比賽（舊 ID 唔會帶去新場）。手機／iPad 要用新比賽 ID 重新加入。\n此操作無法復原。"
    : "確定清除全部資料？此操作無法復原。";
  if (!confirm(msg)) return;
  abandonCloudRoom();
  state = defaultState();
  state.instanceId = newTournamentInstanceId();
  saveState();
  render();
  switchTab("players");
  toast(inCloud ? "已重置並離開舊雲端比賽。請重新建立雲端比賽。" : "已重置", "success");
}

// ─── Export ──────────────────────────────────────────────
function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportStandingsCsv() {
  const ranked = rankedPlayers();
  const lines = [
    "排名,姓名,教會,勝,負,瑞士分,比賽總分,陀螺1組合,陀螺1上蓋,陀螺1固鎖,陀螺1軸心,陀螺2組合,陀螺2上蓋,陀螺2固鎖,陀螺2軸心,陀螺3組合,陀螺3上蓋,陀螺3固鎖,陀螺3軸心,狀態",
  ];
  for (const p of ranked) {
    normalizePlayer(p);
    const status = isKoQualified(p.id) ? "晉級" : "";
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const b = p.beys[i];
      parts.push(
        beyLabel(b, { short: true }),
        partDisplayBlade(b),
        partDisplay(b, "ratchet"),
        partDisplay(b, "bit")
      );
    }
    lines.push(
      [
        p.rank,
        p.name,
        churchFull(p.church),
        p.wins,
        p.losses,
        p.swissPoints,
        p.battlePoints,
        ...parts,
        status,
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(",")
    );
  }
  downloadText("寶螺盃_排名.csv", lines.join("\n"), "text/csv;charset=utf-8");
  document.getElementById("exportPreview").textContent = lines.join("\n");
  toast("已匯出排名 CSV（含陀螺）", "success");
}

function exportMatchesCsv() {
  const lines = ["階段,輪次,場次,報到區,選手1,教會1,選手2,教會2,勝方,P1比賽分,P2比賽分,同教會,標籤"];
  for (const r of state.rounds) {
    for (const m of r.matches) {
      const p1 = playerById(m.p1);
      const p2 = playerById(m.p2);
      const w = m.winner ? playerById(m.winner)?.name : "";
      const same = p1 && p2 && p1.church === p2.church ? "是" : "否";
      lines.push(
        [
          "瑞士",
          r.round,
          m.table,
          m.zoneLabel || zoneLabel(m.zone ?? 0),
          p1?.name || "",
          churchLabel(p1?.church),
          p2?.name || "",
          churchLabel(p2?.church),
          w,
          m.p1Bp,
          m.p2Bp,
          same,
          "",
        ]
          .map((x) => `"${String(x).replace(/"/g, '""')}"`)
          .join(",")
      );
    }
  }
  if (state.knockout) {
    const pushKo = (m, stage) => {
      if (!m) return;
      const p1 = playerById(m.p1);
      const p2 = playerById(m.p2);
      const w = m.winner ? playerById(m.winner)?.name : "";
      const same = p1 && p2 && p1.church === p2.church ? "是" : "否";
      lines.push(
        [
          "淘汰",
          stage,
          "",
          "",
          p1?.name || "",
          churchLabel(p1?.church),
          p2?.name || "",
          churchLabel(p2?.church),
          w,
          m.p1Bp ?? "",
          m.p2Bp ?? "",
          same,
          m.label || "",
        ]
          .map((x) => `"${String(x).replace(/"/g, '""')}"`)
          .join(",")
      );
    };
    (state.knockout.rounds || []).forEach((r) => {
      (r.matches || []).forEach((m) => pushKo(m, r.name || "KO"));
    });
    if (state.knockout.semis) state.knockout.semis.forEach((m) => pushKo(m, "準決賽"));
    pushKo(state.knockout.third, "季軍賽");
    pushKo(state.knockout.final, "決賽");
  }
  downloadText("寶螺盃_對戰紀錄.csv", lines.join("\n"), "text/csv;charset=utf-8");
  document.getElementById("exportPreview").textContent = lines.join("\n");
  toast("已匯出對戰紀錄 CSV（含淘汰賽）", "success");
}

function exportTextReport() {
  const ranked = rankedPlayers();
  let t = "═══ 寶螺盃 瑞士制報告 ═══\n";
  t += `產生時間：${new Date().toLocaleString("zh-HK")}\n`;
  t += `階段：${phaseLabel()}\n\n`;
  t += "【排名】\n";
  ranked.forEach((p) => {
    t += `${p.rank}. ${p.name}（${churchLabel(p.church)}） 勝${p.wins}  總分${p.battlePoints}${isKoQualified(p.id) ? " ★晉級" : ""}${p.tied ? " ＝同分" : ""}\n`;
  });
  t += "\n【陀螺登記】\n";
  state.players.forEach((p, i) => {
    normalizePlayer(p);
    t += `${i + 1}. ${p.name}（${churchLabel(p.church)}）${isDeckComplete(p) ? " ✓" : " 未齊"}\n`;
    p.beys.forEach((b, bi) => {
      t += `   陀螺${bi + 1}: ${beyLabel(b)}\n`;
    });
    const w = checkDeckRestrictions(p);
    if (w.length) t += `   提示: ${w.join("；")}\n`;
  });
  t += "\n【各輪對戰】\n";
  for (const r of state.rounds) {
    t += `\n— 第 ${r.round} 輪 ${r.locked ? "（已鎖定）" : ""} —\n`;
    for (const m of r.matches) {
      const p1 = playerById(m.p1);
      const p2 = playerById(m.p2);
      const same = p1?.church === p2?.church ? "同教會" : "不同教會";
      if (m.done) {
        const w = playerById(m.winner);
        t += `  桌${m.table}: ${p1?.name} ${m.p1Bp} - ${m.p2Bp} ${p2?.name}  → 勝：${w?.name}（${same}）\n`;
      } else {
        t += `  桌${m.table}: ${p1?.name} vs ${p2?.name}（${same}） 未完成\n`;
      }
    }
  }
  if (state.knockout) {
    t += `\n【淘汰賽 ${state.knockout.bracketSize || getKoBracketSize()} 強】\n`;
    for (const m of iterKnockoutMatches()) {
      const p1 = playerById(m.p1);
      const p2 = playerById(m.p2);
      t += `  ${m.label}: ${p1?.name} vs ${p2?.name}`;
      if (m.done) t += ` → ${playerById(m.winner)?.name} 勝 (${m.p1Bp}-${m.p2Bp})`;
      t += "\n";
    }
  }
  downloadText("寶螺盃_報告.txt", t);
  document.getElementById("exportPreview").textContent = t;
  toast("已匯出文字報告", "success");
}

function exportJson(opts = {}) {
  const hideBeyOrder = !!opts.hideBeyOrder;
  const data = stateForExport({ hideBeyOrder });
  const name = hideBeyOrder ? "寶螺盃_匯出_無次序.json" : "寶螺盃_完整備份.json";
  downloadText(name, JSON.stringify(data, null, 2), "application/json");
  toast(hideBeyOrder ? "已匯出（已隱藏出場次序）" : "已匯出完整 JSON 備份", "success");
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.players || !Array.isArray(data.players)) throw new Error("格式錯誤");
      if (!confirm("還原會覆蓋目前資料，確定？")) return;
      pushAutoBackup("還原前自動備份");
      state = { ...defaultState(), ...data };
      state.settings = normalizeSettings(data.settings || state.settings);
      state.players = migratePlayers(state.players);
      state.knockout = migrateKnockout(data.knockout);
      state.draw = normalizeDraw(data.draw);
      saveState();
      render();
      toast("已還原備份", "success");
    } catch (e) {
      toast("JSON 無效：" + e.message, "error");
    }
  };
  reader.readAsText(file);
}

function renderBackupPanel() {
  const el = document.getElementById("backupList");
  if (!el) return;
  const list = listBackups();
  if (!list.length) {
    el.innerHTML = `<div class="meta">尚未有自動備份。鎖定輪次／開始比賽／淘汰賽時會自動保存。亦可按「立即備份」。</div>`;
    return;
  }
  el.innerHTML = list
    .map(
      (b) => `
    <div class="backup-row">
      <div>
        <strong>${escapeHtml(b.label)}</strong>
        <div class="meta">${new Date(b.ts).toLocaleString("zh-HK")} · ${escapeHtml(b.phase || "")} · ${b.playerCount || 0} 人</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm btn-restore-backup" data-id="${escapeAttr(b.id)}">還原</button>
    </div>`
    )
    .join("");
  el.querySelectorAll(".btn-restore-backup").forEach((btn) => {
    btn.addEventListener("click", () => restoreBackupById(btn.dataset.id));
  });
}

// ─── Render ──────────────────────────────────────────────
function phaseLabel() {
  if (state.phase === "setup") return "準備中";
  if (state.phase === "swiss") return `瑞士制 第 ${state.currentRound} 輪`;
  if (state.phase === "knockout") return "淘汰賽";
  if (state.phase === "done") return "已完賽";
  return state.phase;
}

// ─── 計分板（手機／iPad 盲操作）────────────────────────
const DEVICE_ROLE_KEY = "baoluo-cup-next-device-role";
const PAD_ZONE_KEY = "baoluo-cup-next-pad-zone";
let padOpenKey = null;
let padPickSide = null; // "p1" | "p2" | "draw"
let padBeyP1 = 0;
let padBeyP2 = 0;
let padBusy = false;

function getDeviceRole() {
  try {
    const r = sessionStorage.getItem(DEVICE_ROLE_KEY);
    if (r === "score" || r === "desk" || r === "view") return r;
  } catch (_) {}
  return "desk";
}

function setDeviceRole(role) {
  if (role !== "score" && role !== "desk" && role !== "view") role = "desk";
  try {
    sessionStorage.setItem(DEVICE_ROLE_KEY, role);
  } catch (_) {}
  applyDeviceChrome();
}

function isScorePadOpen() {
  const el = document.getElementById("scorePad");
  return !!(el && !el.classList.contains("hidden"));
}

function applyDeviceChrome() {
  const score = getDeviceRole() === "score" || isScorePadOpen();
  document.body.classList.toggle("is-score-pad", score && isScorePadOpen());
}

function getPadZoneFilter() {
  try {
    return sessionStorage.getItem(PAD_ZONE_KEY) || "all";
  } catch (_) {
    return "all";
  }
}

function setPadZoneFilter(z) {
  try {
    sessionStorage.setItem(PAD_ZONE_KEY, String(z));
  } catch (_) {}
}

function padMatchKey(entry) {
  return entry.kind + ":" + entry.id;
}

function listPadMatches() {
  const out = [];
  const round = currentRoundObj();
  if (round) {
    for (const m of round.matches || []) {
      if (isByeMatch(m)) continue;
      out.push({
        kind: "swiss",
        id: m.id,
        match: m,
        round,
        locked: !!round.locked,
        zone: m.zone,
        zoneCode: m.zoneCode || zoneCode(m.zone || 0),
        label: `第${round.round}輪 · ${m.zoneLabel || zoneLabel(m.zone || 0)} · 場次 ${m.table}`,
      });
    }
  }
  (state.cutPlayoff?.matches || []).forEach((m, i) => {
    if (!m || !m.p1 || !m.p2) return;
    out.push({
      kind: "playoff",
      id: m.id,
      match: m,
      locked: false,
      zone: m.zone,
      zoneCode: "加賽",
      label: m.label || `入圍加賽 ${i + 1}`,
    });
  });
  if (state.knockout) {
    (state.knockout.rounds || []).forEach((r, ri) => {
      (r.matches || []).forEach((m, mi) => {
        if (!m || !m.p1 || !m.p2) return;
        out.push({
          kind: "ko",
          id: m.id,
          match: m,
          koRef: { type: "round", roundIndex: ri, matchIndex: mi },
          locked: false,
          zoneCode: "淘汰",
          label: m.label || r.name || "淘汰賽",
        });
      });
    });
    [
      ["third", "季軍賽"],
      ["final", "決賽"],
    ].forEach(([key, lab]) => {
      const m = state.knockout[key];
      if (!m || !m.p1 || !m.p2) return;
      out.push({
        kind: "ko",
        id: m.id,
        match: m,
        koRef: { type: key },
        locked: false,
        zoneCode: "淘汰",
        label: m.label || lab,
      });
    });
  }
  return out;
}

function findPadEntry(key) {
  return listPadMatches().find((e) => padMatchKey(e) === key) || null;
}

function padZoneOptions() {
  const matches = listPadMatches();
  const zones = [];
  const seen = new Set();
  matches.forEach((e) => {
    const z = e.zoneCode || "—";
    if (seen.has(z)) return;
    seen.add(z);
    zones.push(z);
  });
  return zones;
}

function openScorePad() {
  const el = document.getElementById("scorePad");
  if (!el) return;
  el.classList.remove("hidden");
  el.setAttribute("aria-hidden", "false");
  if (getDeviceRole() === "desk") {
    /* keep desk role so returning to 大會畫面 works */
  } else {
    setDeviceRole("score");
  }
  applyDeviceChrome();
  document.body.classList.add("is-score-pad");
  renderScorePad();
}

function closeScorePad() {
  padOpenKey = null;
  padPickSide = null;
  const el = document.getElementById("scorePad");
  if (el) {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
  }
  if (getDeviceRole() === "score") setDeviceRole("desk");
  document.body.classList.remove("is-score-pad");
  applyDeviceChrome();
  render();
}

function padVibrate() {
  try {
    navigator.vibrate?.(12);
  } catch (_) {}
}

function padVideoFileName() {
  const ts = new Date();
  const stamp =
    ts.getFullYear() +
    String(ts.getMonth() + 1).padStart(2, "0") +
    String(ts.getDate()).padStart(2, "0") +
    "_" +
    String(ts.getHours()).padStart(2, "0") +
    String(ts.getMinutes()).padStart(2, "0");
  const entry = padOpenKey ? findPadEntry(padOpenKey) : null;
  const p1 = entry ? playerById(entry.match?.p1)?.name : "";
  const p2 = entry ? playerById(entry.match?.p2)?.name : "";
  const vs = p1 && p2 ? `${p1}vs${p2}` : "比賽";
  const zone = entry?.zoneCode || "";
  const raw = ["寶螺盃", zone, vs, stamp].filter(Boolean).join("_");
  return raw.replace(/[\\/:*?"<>|]+/g, "") + ".mp4";
}

function padStartCapture() {
  const input = document.getElementById("padVideoCapture");
  if (!input) {
    toast("呢部裝置開唔到鏡頭", "error");
    return;
  }
  input.value = "";
  input.click();
}

function padDownloadLocal(file, name) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name || file.name || "baoluo.mp4";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("已交俾你部手機儲存。網站同雲端都冇存片。", "success");
}

async function padOnVideoCaptured(ev) {
  const input = ev.target;
  const src = input.files && input.files[0];
  input.value = "";
  if (!src) return;
  const name = padVideoFileName();
  const file =
    src.name && src.name !== "blob"
      ? src
      : new File([src], name, { type: src.type || "video/mp4" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: name,
        text: "寶螺盃比賽紀錄 · 請揀「儲存影片」到相簿。唔好傳到雲端。",
      });
      toast("影片只喺你部手機。網站同雲端都冇存。", "success");
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") {
      padDownloadLocal(file, name);
      return;
    }
  }
  padDownloadLocal(file, name);
}

/** 頭 3 盤已用過嘅陀螺 index；第 4 盤起唔再限制。 */
function padUsedBeySet(match, side) {
  const battles = match?.battles || [];
  if (battles.length >= 3) return new Set();
  const key = side === "p2" ? "p2BeyIndex" : "p1BeyIndex";
  const used = new Set();
  for (const b of battles) {
    if (b[key] == null || b[key] === "") continue;
    const n = Number(b[key]);
    if (n === 0 || n === 1 || n === 2) used.add(n);
  }
  return used;
}

function padFirstFreeBey(match, side, prefer) {
  const used = padUsedBeySet(match, side);
  const pref = prefer === 0 || prefer === 1 || prefer === 2 ? prefer : null;
  if (pref != null && !used.has(pref)) return pref;
  for (const i of [0, 1, 2]) if (!used.has(i)) return i;
  return pref != null ? pref : 0;
}

function initPadBeys(entry) {
  const m = entry?.match;
  const n = m?.battles?.length || 0;
  const d1 = defaultBeyIndexForBattle(m?.p1BeyOrder, n);
  const d2 = defaultBeyIndexForBattle(m?.p2BeyOrder, n);
  padBeyP1 = padFirstFreeBey(m, "p1", d1);
  padBeyP2 = padFirstFreeBey(m, "p2", d2);
}

function padBeyChecksHtml(player, side, selected, disabled, used) {
  if (player) normalizePlayer(player);
  const usedSet = used || new Set();
  return `<div class="sp-beys">
    ${[0, 1, 2]
      .map((i) => {
        const lab = beyShortAt(player, i);
        const empty = !lab || lab === "—" || lab === "（未登記）";
        const on = selected === i;
        const taken = usedSet.has(i);
        return `<label class="sp-bey ${on ? "on" : ""} ${empty ? "empty" : ""} ${taken ? "used" : ""}">
          <input type="checkbox" data-sp="bey" data-side="${side}" data-i="${i}" ${on ? "checked" : ""} ${disabled || taken ? "disabled" : ""} />
          <span class="sp-bey-box" aria-hidden="true"></span>
          <span class="sp-bey-n">${i + 1}</span>
          <span class="sp-bey-lab">${escapeHtml(empty ? "未登記" : taken ? lab + " · 已用" : lab)}</span>
        </label>`;
      })
      .join("")}
  </div>`;
}

function padCanWrite(entry) {
  if (window.BaoluoSync?.isReadOnly?.()) return false;
  if (!entry) return false;
  if (entry.kind === "swiss" && entry.round?.locked) return false;
  const m = entry.match;
  if (!m || isByeMatch(m) || m.lateForfeit) return false;
  return true;
}

function padRecordBattle(entry, winnerId, finishType) {
  if (!assertCanWrite()) return false;
  if (!padCanWrite(entry)) {
    toast(entry?.round?.locked ? "本輪已鎖定" : "呢場唔可以入分", "error");
    return false;
  }
  const m = entry.match;
  ensureMatchBeyOrders(m);
  m.battles = normalizeBattles(m.battles || []);
  if (m.done) {
    toast("呢場已完場", "error");
    return false;
  }
  if (padBeyP1 == null || padBeyP2 == null) {
    toast("請兩邊都勾選用緊邊隻陀螺", "error");
    return false;
  }
  if (finishType === "draw" || !winnerId) {
    toast("請揀邊個贏同完場方式", "error");
    return false;
  }
  const used1 = padUsedBeySet(m, "p1");
  const used2 = padUsedBeySet(m, "p2");
  if (used1.has(padBeyP1) || used2.has(padBeyP2)) {
    toast("頭 3 盤唔可以重複用同一隻陀螺", "error");
    return false;
  }
  const ft = finishType;
  m.battles.push({
    id: uid("b"),
    p1BeyIndex: padBeyP1,
    p2BeyIndex: padBeyP2,
    winnerId: ft === "draw" ? null : winnerId,
    finishType: ft,
    points: finishPts(ft),
  });
  applyBattleTotals(m);
  if (entry.kind === "playoff") {
    if (m.done && !m.winner) {
      m.done = false;
      m.draw = false;
      toast("入圍加賽必須分勝方，請繼續打", "error");
    } else if (m.done) {
      maybeAdvanceCutPlayoff();
    }
  }
  if (entry.kind === "ko") {
    if (m.done && m.winner) {
      tryAdvanceKnockout();
      if (state.knockout.final?.done && state.knockout.third?.done) state.phase = "done";
      else state.phase = "knockout";
    }
  }
  saveState();
  padPickSide = null;
  initPadBeys(entry);
  padVibrate();
  render();
  return true;
}

function padUndoBattle(entry) {
  if (!assertCanWrite()) return;
  if (!padCanWrite(entry) && !(entry?.match && !entry.round?.locked)) {
    toast("唔可以還原", "error");
    return;
  }
  if (entry.kind === "ko" && entry.match?.done && koMatchHasDownstream(entry.koRef || {})) {
    toast("淘汰賽已晉級，請返主電腦改", "error");
    return;
  }
  const m = entry.match;
  if (!m.battles?.length) {
    toast("未有 Battle 可還原", "error");
    return;
  }
  const last = m.battles.pop();
  applyBattleTotals(m);
  if (last) {
    padBeyP1 = last.p1BeyIndex == null ? padBeyP1 : last.p1BeyIndex;
    padBeyP2 = last.p2BeyIndex == null ? padBeyP2 : last.p2BeyIndex;
  }
  saveState();
  padVibrate();
  render();
}

function renderScorePad() {
  const pad = document.getElementById("scorePad");
  const top = document.getElementById("scorePadTop");
  const body = document.getElementById("scorePadBody");
  if (!pad || pad.classList.contains("hidden") || !top || !body) return;

  const roomId = window.BaoluoSync?.getRoomId?.() || "";
  const readonly = !!window.BaoluoSync?.isReadOnly?.();
  const filter = getPadZoneFilter();
  const all = listPadMatches();
  const zones = padZoneOptions();
  const list = all.filter((e) => {
    if (filter === "all") return true;
    if (filter === "open") return !e.match.done;
    return String(e.zoneCode) === String(filter);
  });
  const openN = all.filter((e) => !e.match.done && !e.match.lateForfeit).length;

  if (padOpenKey) {
    const entry = findPadEntry(padOpenKey);
    if (!entry) {
      padOpenKey = null;
      padPickSide = null;
    } else {
      renderScorePadMatch(top, body, entry, { roomId, readonly, openN });
      return;
    }
  }

  top.innerHTML = `
    <div class="sp-bar">
      <div class="sp-bar-id">${roomId ? escapeHtml(roomId) : "本機"} · 計分板</div>
      <button type="button" class="sp-icon" data-sp="join" title="加入雲端比賽">${roomId ? "換房" : "雲端"}</button>
      <button type="button" class="sp-icon sp-rec" data-sp="rec" title="用手機拍片，只存你部機">拍片</button>
      <button type="button" class="sp-icon" data-sp="desk" title="返大會畫面">大會</button>
    </div>
    <div class="sp-scoreline">${openN} 場進行中</div>
    <div class="sp-zones">
      <button type="button" class="sp-chip ${filter === "all" ? "on" : ""}" data-sp="zone" data-z="all">全部</button>
      <button type="button" class="sp-chip ${filter === "open" ? "on" : ""}" data-sp="zone" data-z="open">未完場</button>
      ${zones
        .map(
          (z) =>
            `<button type="button" class="sp-chip ${filter === String(z) ? "on" : ""}" data-sp="zone" data-z="${escapeAttr(String(z))}">${escapeHtml(/^[A-P]$/i.test(String(z)) ? z + "區" : String(z))}</button>`
        )
        .join("")}
    </div>
    ${readonly ? `<div class="sp-warn">只讀模式：入唔到分。加入時請填主持碼並揀「計分板」。</div>` : ""}
  `;

  if (!list.length) {
    body.innerHTML = `<div class="sp-empty">而家冇場要入。<br>等主電腦產生對戰表／下一輪。</div>`;
    return;
  }

  const live = list.filter((e) => !e.match.done);
  const done = list.filter((e) => e.match.done);
  const card = (e) => {
    const p1 = playerById(e.match.p1);
    const p2 = playerById(e.match.p2);
    const t = totalsFromBattles(e.match.p1, e.match.p2, e.match.battles || []);
    const p1s = e.match.done ? e.match.p1Bp : t.p1Bp;
    const p2s = e.match.done ? e.match.p2Bp : t.p2Bp;
    const auto = e.match.lateForfeit ? " · 遲到0–4" : "";
    return `
      <button type="button" class="sp-match ${e.match.done ? "is-done" : ""}" data-sp="open" data-key="${escapeAttr(padMatchKey(e))}">
        <div class="sp-match-meta">${escapeHtml(e.zoneCode || "")} · ${escapeHtml(e.label)}${auto}</div>
        <div class="sp-match-row">
          <span class="sp-mn ${e.match.winner === e.match.p1 ? "win" : ""}">${escapeHtml(p1?.name || "?")}</span>
          <span class="sp-ms">${p1s} : ${p2s}</span>
          <span class="sp-mn ${e.match.winner === e.match.p2 ? "win" : ""}">${escapeHtml(p2?.name || "?")}</span>
        </div>
      </button>`;
  };
  body.innerHTML = `
    <div class="sp-list">${live.map(card).join("")}</div>
    ${done.length ? `<div class="sp-done-lab">已完場</div><div class="sp-list">${done.map(card).join("")}</div>` : ""}
  `;
}

function renderScorePadMatch(top, body, entry, meta) {
  const m = entry.match;
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  const t = totalsFromBattles(m.p1, m.p2, m.battles || []);
  const can = padCanWrite(entry) && !meta.readonly;
  const used1 = padUsedBeySet(m, "p1");
  const used2 = padUsedBeySet(m, "p2");
  const finishes = [
    { id: "extreme", lab: "Extreme", pts: 3 },
    { id: "over", lab: "Over", pts: 2 },
    { id: "burst", lab: "Burst", pts: 2 },
    { id: "spin", lab: "Spin", pts: 1 },
  ];
  top.innerHTML = `
    <div class="sp-bar">
      <button type="button" class="sp-icon" data-sp="back">← 場次</button>
      <div class="sp-bar-id">${escapeHtml(entry.zoneCode || "")} · ${escapeHtml(entry.label)}</div>
      <button type="button" class="sp-icon" data-sp="join" title="加入雲端比賽">${meta.roomId ? "換房" : "雲端"}</button>
      <button type="button" class="sp-icon sp-rec" data-sp="rec" title="用手機拍片，只存你部機">拍片</button>
      <button type="button" class="sp-icon" data-sp="desk">大會</button>
    </div>
  `;
  const last = (m.battles || [])[(m.battles || []).length - 1];
  const lastTxt = last
    ? `上一盤：${last.finishType === "draw" ? "平手 0" : `${playerById(last.winnerId)?.name || "?"} +${last.points || finishPts(last.finishType)}`}（${beyShortAt(p1, last.p1BeyIndex)} vs ${beyShortAt(p2, last.p2BeyIndex)}）`
    : "未有 Battle";
  body.innerHTML = `
    <div class="sp-scoreboard">
      <button type="button" class="sp-player ${padPickSide === "p1" ? "pick" : ""} ${t.winnerId === m.p1 ? "win" : ""}" data-sp="pick" data-side="p1" ${!can || t.done ? "disabled" : ""}>
        <span class="sp-pname">${escapeHtml(p1?.name || "選手1")}</span>
        <span class="sp-ppts">${t.p1Bp}</span>
      </button>
      <div class="sp-colon">VS</div>
      <button type="button" class="sp-player ${padPickSide === "p2" ? "pick" : ""} ${t.winnerId === m.p2 ? "win" : ""}" data-sp="pick" data-side="p2" ${!can || t.done ? "disabled" : ""}>
        <span class="sp-pname">${escapeHtml(p2?.name || "選手2")}</span>
        <span class="sp-ppts">${t.p2Bp}</span>
      </button>
    </div>
    <div class="sp-bey-row">
      ${padBeyChecksHtml(p1, "p1", padBeyP1, !can || t.done, used1)}
      <div class="sp-bey-mid">用緊</div>
      ${padBeyChecksHtml(p2, "p2", padBeyP2, !can || t.done, used2)}
    </div>
    <div class="sp-hint">${
      t.done
        ? t.draw
          ? "完場 · 無分"
          : `完場 · ${escapeHtml(playerById(t.winnerId)?.name || "")} 勝`
        : padBeyP1 == null || padBeyP2 == null
          ? "兩邊都勾選用緊邊隻陀螺"
          : padPickSide
            ? "再撳完場方式"
            : "撳邊個贏咗呢一盤，再撳 Extreme／Over／Burst／Spin"
    }</div>
    ${
      t.done
        ? `<button type="button" class="sp-next" data-sp="back">下一場</button>`
        : can
          ? `<div class="sp-finishes ${padPickSide ? "ready" : "wait"}">
        ${finishes
          .map(
            (f) =>
              `<button type="button" class="sp-fin sp-fin-${f.id}" data-sp="fin" data-ft="${f.id}" ${padPickSide ? "" : "disabled"}><b>${f.pts}</b><span>${f.lab}</span></button>`
          )
          .join("")}
      </div>`
          : `<div class="sp-warn">${entry.round?.locked ? "本輪已鎖定" : "無法入分"}</div>`
    }
    <div class="sp-tools">
      <div class="sp-last">${escapeHtml(lastTxt)} · ${m.battles?.length || 0} 盤</div>
      <button type="button" class="sp-undo" data-sp="undo" ${!can || !m.battles?.length ? "disabled" : ""}>還原上一盤</button>
    </div>
  `;
}

function onScorePadClick(e) {
  const btn = e.target.closest("[data-sp]");
  if (!btn || padBusy) return;
  const act = btn.dataset.sp;
  if (act === "rec") {
    padStartCapture();
    return;
  }
  if (act === "join") {
    openPadJoinModal();
    return;
  }
  if (act === "desk") {
    if (getDeviceRole() === "score") {
      if (!confirm("離開計分板，改睇大會畫面？手機之後可以再撳「計分板」。")) return;
    }
    closeScorePad();
    return;
  }
  if (act === "zone") {
    setPadZoneFilter(btn.dataset.z || "all");
    padOpenKey = null;
    renderScorePad();
    return;
  }
  if (act === "open") {
    padOpenKey = btn.dataset.key;
    padPickSide = null;
    initPadBeys(findPadEntry(padOpenKey));
    renderScorePad();
    return;
  }
  if (act === "back") {
    padOpenKey = null;
    padPickSide = null;
    renderScorePad();
    return;
  }
  const entry = padOpenKey ? findPadEntry(padOpenKey) : null;
  if (act === "bey") {
    e.preventDefault();
    const i = Number(btn.dataset.i);
    const used = padUsedBeySet(entry?.match, btn.dataset.side === "p2" ? "p2" : "p1");
    if (used.has(i)) {
      toast("頭 3 盤唔可以重複用同一隻陀螺", "error");
      return;
    }
    if (btn.dataset.side === "p2") padBeyP2 = padBeyP2 === i ? null : i;
    else padBeyP1 = padBeyP1 === i ? null : i;
    renderScorePad();
    return;
  }
  if (act === "pick") {
    padPickSide = btn.dataset.side === "p2" ? "p2" : "p1";
    renderScorePad();
    return;
  }
  if (act === "undo") {
    if (entry) padUndoBattle(entry);
    return;
  }
  if (act === "fin") {
    if (!entry) return;
    if (padBeyP1 == null || padBeyP2 == null) {
      toast("請兩邊都勾選用緊邊隻陀螺", "error");
      return;
    }
    const ft = btn.dataset.ft;
    if (ft === "draw") return;
    if (!padPickSide) {
      toast("先撳邊個贏", "error");
      return;
    }
    const winnerId = padPickSide === "p1" ? entry.match.p1 : entry.match.p2;
    padBusy = true;
    try {
      padRecordBattle(entry, winnerId, ft);
    } finally {
      setTimeout(() => {
        padBusy = false;
      }, 180);
    }
  }
}

function render() {
  document.getElementById("phasePill").textContent = phaseLabel();
  document.getElementById("roundPill").textContent =
    state.phase === "swiss"
      ? `第 ${state.currentRound} / ${getSwissRounds()} 輪`
      : state.phase === "setup"
        ? "未開始"
        : state.phase === "knockout" || state.phase === "done"
          ? "淘汰賽"
          : "—";
  renderSettings();
  renderRules();
  renderPlayers();
  renderPairings();
  renderStandings();
  renderHistory();
  renderTies();
  renderKnockout();
  renderDraw();
  renderBackupPanel();
  renderHeaderTime();
  updateSyncUi();
  if (isScorePadOpen()) renderScorePad();
}

function renderHeaderTime() {
  const el = document.getElementById("saveTime");
  if (el && state.updatedAt) {
    el.textContent = "上次儲存 " + new Date(state.updatedAt).toLocaleTimeString("zh-HK");
  }
  const rev = document.getElementById("revPill");
  if (rev) rev.textContent = state._rev ? `rev ${state._rev}` : "";
}

/** 選手列表篩選：教會 + 陀螺登記狀態 */
let playerFilterChurch = "all"; // all | kcc | ky
let playerFilterDeck = "all"; // all | done | pending

function getFilteredPlayers() {
  return state.players.filter((p) => {
    if (playerFilterChurch !== "all" && p.church !== playerFilterChurch) return false;
    const done = isDeckComplete(p);
    if (playerFilterDeck === "done" && !done) return false;
    if (playerFilterDeck === "pending" && done) return false;
    return true;
  });
}

function syncPlayerFilterChips() {
  document.querySelectorAll("[data-filter-church]").forEach((btn) => {
    const on = btn.dataset.filterChurch === playerFilterChurch;
    btn.classList.toggle("active", on);
  });
  document.querySelectorAll("[data-filter-deck]").forEach((btn) => {
    const on = btn.dataset.filterDeck === playerFilterDeck;
    btn.classList.toggle("active", on);
  });
}

function renderPlayers() {
  state.players.forEach(normalizePlayer);

  document.getElementById("playerCount").textContent = `${state.players.length} / ${getTotalPlayers()}`;
  const kcc = state.players.filter((p) => p.church === "kcc").length;
  const ky = state.players.filter((p) => p.church === "ky").length;
  const deckDone = state.players.filter((p) => isDeckComplete(p)).length;
  const deckPartial = state.players.filter((p) => {
    const n = deckProgress(p);
    return n > 0 && n < 3;
  }).length;
  const deckNone = state.players.length - deckDone - deckPartial;

  document.getElementById("churchSummary").innerHTML = `
    <span><span class="church-tag kcc">城基</span> <strong>${kcc}</strong> 人</span>
    <span><span class="church-tag ky">基蔭</span> <strong>${ky}</strong> 人</span>
  `;

  document.getElementById("deckSummaryBar").innerHTML = `
    <span class="ds-item">已預登姓名 <strong>${state.players.length}</strong> / ${getTotalPlayers()}</span>
    <span class="ds-item ok">陀螺齊 3 隻 <strong>${deckDone}</strong></span>
    <span class="ds-item warn">部分登記 <strong>${deckPartial}</strong></span>
    <span class="ds-item">未登陀螺 <strong>${deckNone}</strong></span>
    <span class="ds-item warn">遲到 <strong>${state.players.filter((p) => p.late).length}</strong></span>
  `;

  syncPlayerFilterChips();

  const filtered = getFilteredPlayers();
  const filterCountEl = document.getElementById("playerFilterCount");
  if (filterCountEl) {
    const filtering = playerFilterChurch !== "all" || playerFilterDeck !== "all";
    filterCountEl.textContent = filtering
      ? `顯示 ${filtered.length} / ${state.players.length} 人`
      : state.players.length
        ? `共 ${state.players.length} 人`
        : "";
  }

  const list = document.getElementById("playerCards");
  if (!state.players.length) {
    list.innerHTML = `<div class="empty"><div class="big">📝</div>尚未登記選手。<br>可先預先輸入 ${getTotalPlayers()} 人姓名，活動當日再按「登記陀螺」。</div>`;
  } else if (!filtered.length) {
    list.innerHTML = `<div class="empty"><div class="big">🔍</div>沒有符合篩選嘅選手。<br>可改篩選條件或按「全部」。</div>`;
  } else {
    list.innerHTML = filtered
      .map((p) => {
        const i = state.players.findIndex((x) => x.id === p.id);
        const prog = deckProgress(p);
        const complete = prog === 3;
        const partial = prog > 0 && prog < 3;
        const statusClass = complete ? "complete" : partial ? "partial" : "name-only";
        const statusText = complete ? "陀螺已齊 3/3" : partial ? `陀螺登記中 ${prog}/3` : "僅預登姓名";
        const cardClass = complete ? "deck-done" : partial ? "deck-partial" : "";
        const warnings = complete ? checkDeckRestrictions(p) : [];
        const beyMinis = (p.beys || emptyBeys())
          .map((b, bi) => {
            const empty = !isBeyComplete(b) && !partDisplayBlade(b) && !partDisplay(b, "ratchet") && !partDisplay(b, "bit");
            return `<div class="pc-bey-mini ${empty ? "empty" : ""}">
              <div class="bn">陀螺 ${bi + 1}${getBeyTier(b) ? ` · ${getBeyTier(b)}` : ""}</div>
              <div class="bv">${escapeHtml(beyLabel(b, { short: true }))}</div>
              <div class="bv-sub">${empty ? "" : escapeHtml(beyLabel(b))}</div>
            </div>`;
          })
          .join("");

        return `
        <div class="player-card ${cardClass}${p.late ? " is-late" : ""}" data-id="${p.id}">
          <div class="pc-top">
            <span class="pc-num">#${i + 1}</span>
            <div class="pc-name">
              <input type="text" class="pc-name-input" data-id="${p.id}" value="${escapeAttr(p.name)}" maxlength="20" />
            </div>
            <div class="pc-church church-checks compact" data-id="${p.id}" role="radiogroup">
              <label class="church-check kcc ${p.church === "kcc" ? "on" : ""}">
                <input type="radio" class="pc-church-radio" name="church_${p.id}" data-id="${p.id}" value="kcc"
                  ${p.church === "kcc" ? "checked" : ""} ${state.phase !== "setup" ? "disabled" : ""} />
                <span>城基</span>
              </label>
              <label class="church-check ky ${p.church === "ky" ? "on" : ""}">
                <input type="radio" class="pc-church-radio" name="church_${p.id}" data-id="${p.id}" value="ky"
                  ${p.church === "ky" ? "checked" : ""} ${state.phase !== "setup" ? "disabled" : ""} />
                <span>基蔭</span>
              </label>
            </div>
            <label class="pc-late-check ${p.late ? "on" : ""}" title="已知會遲到、尚未到場先勾。到達後取消：之後輪次當準時，唔再自動 0–4。本輪已記嘅坐場 0–4 會保留。">
              <input type="checkbox" class="pc-late-input" data-id="${p.id}" ${p.late ? "checked" : ""} />
              <span>遲到</span>
            </label>
            <span class="pc-status ${statusClass}">${statusText}</span>
            <div class="pc-actions">
              <button type="button" class="btn btn-primary btn-sm btn-deck" data-id="${p.id}">
                ${complete ? "修改陀螺" : "登記陀螺"}
              </button>
              ${
                state.phase === "setup"
                  ? `<button type="button" class="btn btn-ghost btn-sm btn-del" data-id="${p.id}">刪除</button>`
                  : ""
              }
            </div>
          </div>
          <div class="pc-beys">${beyMinis}</div>
          ${warnings.length ? `<div class="pc-warn">⚠ ${warnings.map(escapeHtml).join("；")}</div>` : ""}
        </div>`;
      })
      .join("");
  }

  list.querySelectorAll(".pc-name-input").forEach((inp) => {
    inp.addEventListener("change", () => updatePlayerName(inp.dataset.id, inp.value));
  });
  list.querySelectorAll(".pc-church-radio").forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      const group = radio.closest(".church-checks");
      syncChurchCheckStyles(group);
      updatePlayerChurch(radio.dataset.id, radio.value);
    });
  });
  list.querySelectorAll(".btn-del").forEach((btn) => {
    btn.addEventListener("click", () => removePlayer(btn.dataset.id));
  });
  list.querySelectorAll(".btn-deck").forEach((btn) => {
    btn.addEventListener("click", () => openDeckModal(btn.dataset.id));
  });
  list.querySelectorAll(".pc-late-input").forEach((inp) => {
    inp.addEventListener("change", () => setPlayerLate(inp.dataset.id, inp.checked));
  });

  const addBtn = document.getElementById("btnAddPlayer");
  const addLabel = document.getElementById("addPlayerHeading");
  const started = state.phase !== "setup";
  if (addBtn) addBtn.textContent = started ? "加入遲到選手" : "預先登記";
  if (addLabel) addLabel.textContent = started ? "遲到後加入" : "預先登記姓名";

  const startBtn = document.getElementById("btnStartTournament");
  startBtn.disabled = !(state.phase === "setup" && state.players.length >= 2);
  document.getElementById("btnFillDemo").disabled = state.phase !== "setup";
  document.getElementById("btnClearPlayers").disabled = state.phase !== "setup";
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 對戰表顯示：project = 投影看板；staff = 計分操作 */
let pairingsViewMode = "project";

function setPairingsViewMode(mode) {
  pairingsViewMode = mode === "staff" ? "staff" : "project";

  document.querySelectorAll(".pair-mode-btn").forEach((b) => {
    const on = b.dataset.pairView === pairingsViewMode;
    b.classList.toggle("active", on);
    b.classList.toggle("btn-secondary", on);
    b.classList.toggle("btn-primary", false);
    b.classList.toggle("btn-ghost", !on);
  });
  document.querySelectorAll(".staff-tools").forEach((el) => {
    el.style.display = pairingsViewMode === "staff" ? "" : "none";
  });
  const panel = document.querySelector(".pairings-panel");
  if (panel) {
    panel.classList.toggle("is-project", pairingsViewMode === "project");
    panel.classList.toggle("is-staff", pairingsViewMode === "staff");
  }
  updateProjectionBodyClass();
  // 只重繪對戰內容，避免整頁 reset 導致按鈕狀態錯亂
  renderPairings();
}

function renderMatchCardStaff(m, round, statsMap) {
  ensureMatchBeyOrders(m);
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  const bye = isByeMatch(m);
  const same = !bye && p1 && p2 && p1.church === p2.church;
  const s1 = statsMap[m.p1] || { swissPoints: 0, battlePoints: 0 };
  const s2 = statsMap[m.p2] || { swissPoints: 0, battlePoints: 0 };
  const pre1 = m.done && m.winner === m.p1 ? s1.swissPoints - 1 : s1.swissPoints;
  const pre2 = m.done && m.winner === m.p2 ? s2.swissPoints - 1 : s2.swissPoints;
  const zLabel = m.zoneLabel || zoneLabel(m.zone ?? 0);
  const zCode = m.zoneCode || zoneCode(m.zone ?? 0);
  // 次序只作內部登記，畫面唔顯示具體陀螺（避免被人偷睇）
  const orderReady =
    isBeyOrderComplete(m.p1BeyOrder) && isBeyOrderComplete(m.p2BeyOrder);

  if (m.lateForfeit) {
    return `
    <div class="match-card done" data-zone="${zCode}">
      <div class="match-top">
        <span class="match-num">場次 ${m.table}</span>
        <span class="zone-badge zone-${zCode}">報到：${escapeHtml(zLabel)}</span>
        <span class="vs-tag same">遲到 0–4</span>
      </div>
      <div class="match-players">
        <div class="player-side ${m.winner === m.p1 ? "winner" : "loser"}">
          <div class="p-name">${escapeHtml(p1?.name || "?")}${isLatePlayer(p1) ? ` <span class="late-badge">遲到</span>` : ""}</div>
          <div class="p-meta"><span class="church-tag ${p1?.church}">${churchLabel(p1?.church)}</span></div>
          <div class="p-meta">本輪前 ${pre1} 勝</div>
          <div class="p-bp">${m.p1Bp}</div>
        </div>
        <div class="vs-center">VS</div>
        <div class="player-side ${m.winner === m.p2 ? "winner" : "loser"}">
          <div class="p-name">${escapeHtml(p2?.name || "?")}${isLatePlayer(p2) ? ` <span class="late-badge">遲到</span>` : ""}</div>
          <div class="p-meta"><span class="church-tag ${p2?.church}">${churchLabel(p2?.church)}</span></div>
          <div class="p-meta">本輪前 ${pre2} 勝</div>
          <div class="p-bp">${m.p2Bp}</div>
        </div>
      </div>
      <div class="match-actions">
        <button class="btn btn-ghost btn-sm" disabled>遲到自動 0–4</button>
      </div>
    </div>`;
  }

  if (bye) {
    const lateSit = !!m.lateSitLoss;
    return `
    <div class="match-card done" data-zone="${zCode}">
      <div class="match-top">
        <span class="match-num">場次 ${m.table}</span>
        <span class="zone-badge zone-${zCode}">報到：${escapeHtml(zLabel)}</span>
        <span class="vs-tag ${lateSit ? "same" : "diff"}">${lateSit ? "遲到坐場 0–4" : "自動獲勝"}</span>
      </div>
      <div class="match-players">
        <div class="player-side ${lateSit ? "loser" : "winner"}">
          <div class="p-name">${escapeHtml(p1?.name || "?")}${lateSit ? ` <span class="late-badge">遲到</span>` : ""}</div>
          <div class="p-meta"><span class="church-tag ${p1?.church}">${churchLabel(p1?.church)}</span></div>
          <div class="p-meta">本輪前 ${pre1} 勝</div>
          ${lateSit ? `<div class="p-bp">0</div>` : ""}
        </div>
        <div class="vs-center">VS</div>
        <div class="player-side">
          <div class="p-name">（無對手）</div>
          <div class="p-meta">${lateSit ? "遲到坐場 · 計 0–4 負" : "自動獲勝 · 計 1 勝"}</div>
        </div>
      </div>
      <div class="match-actions">
        <button class="btn btn-ghost btn-sm" disabled>${lateSit ? "遲到坐場 0–4" : "自動獲勝"}</button>
      </div>
    </div>`;
  }

  return `
    <div class="match-card ${m.done ? "done" : ""} ${same ? "same-church" : "diff-church"}" data-zone="${zCode}">
      <div class="match-top">
        <span class="match-num">場次 ${m.table}</span>
        <span class="zone-badge zone-${zCode}">報到：${escapeHtml(zLabel)}</span>
        <span class="vs-tag ${same ? "same" : "diff"}">${same ? "同教會" : "不同教會"}</span>
      </div>
      <div class="match-players">
        <div class="player-side ${m.done && m.winner === m.p1 ? "winner" : ""} ${m.done && m.winner === m.p2 ? "loser" : ""}">
          <div class="p-name">${escapeHtml(p1?.name || "?")}</div>
          <div class="p-meta"><span class="church-tag ${p1?.church}">${churchLabel(p1?.church)}</span></div>
          <div class="p-meta">本輪前 ${pre1} 勝</div>
          ${m.done ? `<div class="p-bp">${m.p1Bp}</div>` : ""}
        </div>
        <div class="vs-center">VS</div>
        <div class="player-side ${m.done && m.winner === m.p2 ? "winner" : ""} ${m.done && m.winner === m.p1 ? "loser" : ""}">
          <div class="p-name">${escapeHtml(p2?.name || "?")}</div>
          <div class="p-meta"><span class="church-tag ${p2?.church}">${churchLabel(p2?.church)}</span></div>
          <div class="p-meta">本輪前 ${pre2} 勝</div>
          ${m.done ? `<div class="p-bp">${m.p2Bp}</div>` : ""}
        </div>
      </div>
      <div class="match-actions">
        ${
          round.locked
            ? `<button class="btn btn-ghost btn-sm" disabled>${m.done ? "已鎖定" : "未完成"}</button>
               <button class="btn btn-ghost btn-sm btn-bey-order" data-id="${m.id}">次序（已鎖）</button>`
            : `
               <button class="btn btn-secondary btn-sm btn-bey-order" data-id="${m.id}">${orderReady ? "改次序" : "登記次序"}</button>
               ${
                 m.done
                   ? `<button class="btn btn-secondary btn-sm btn-edit-score" data-id="${m.id}">修改結果</button>
                      <button class="btn btn-ghost btn-sm btn-clear-score" data-id="${m.id}">清除</button>`
                   : `<button class="btn btn-primary btn-sm btn-enter-score" data-id="${m.id}">輸入結果</button>`
               }`
        }
      </div>
    </div>`;
}

/**
 * 投影看板：按報到區分行
 * 第 1 行 = A 區所有對戰（雙方放埋一齊）
 * 第 2 行 = B 區 …
 * 例：A區：甲 vs 乙 | 丙 vs 丁
 */
function renderProjectionBoard(round) {
  const stations = getActiveStations();
  const byZone = {};
  for (let z = 0; z < stations; z++) byZone[z] = [];
  round.matches.forEach((m) => {
    const z = m.zone != null ? m.zone : 0;
    if (!byZone[z]) byZone[z] = [];
    byZone[z].push(m);
  });
  // 區內按場次排序
  Object.keys(byZone).forEach((z) => {
    byZone[z].sort((a, b) => (a.table || 0) - (b.table || 0));
  });

  const zoneRows = Object.keys(byZone)
    .sort((a, b) => Number(a) - Number(b))
    .map((z) => {
      const zNum = Number(z);
      const zCode = zoneCode(zNum);
      const zLab = zoneLabel(zNum);
      const list = byZone[z];
      if (!list.length) return "";

      const matchCells = list
        .map((m) => {
          const p1 = playerById(m.p1);
          if (isByeMatch(m)) {
            const lateSit = !!m.lateSitLoss;
            return `
            <div class="zg-match is-done">
              <div class="zg-pair">
                <span class="zg-p ${lateSit ? "is-lose" : "is-win"}">${escapeHtml(p1?.name || "?")}</span>
                <span class="zg-vs">VS</span>
                <span class="zg-p">（無對手）</span>
              </div>
              <span class="zg-score">${lateSit ? "0–4 · 遲到坐場" : "自動獲勝"}</span>
            </div>`;
          }
          if (m.lateForfeit) {
            const lp2 = playerById(m.p2);
            return `
            <div class="zg-match is-done">
              <div class="zg-pair">
                <span class="zg-p ${m.winner === m.p1 ? "is-win" : "is-lose"}">${escapeHtml(p1?.name || "?")}</span>
                <span class="zg-vs">VS</span>
                <span class="zg-p ${m.winner === m.p2 ? "is-win" : "is-lose"}">${escapeHtml(lp2?.name || "?")}</span>
              </div>
              <span class="zg-score">${m.p1Bp}–${m.p2Bp} · 遲到</span>
            </div>`;
          }
          const p2 = playerById(m.p2);
          const w1 = m.done && m.winner === m.p1 ? "is-win" : m.done ? "is-lose" : "";
          const w2 = m.done && m.winner === m.p2 ? "is-win" : m.done ? "is-lose" : "";
          const score = m.done
            ? `<span class="zg-score">${m.p1Bp}–${m.p2Bp}</span>`
            : `<span class="zg-live">對戰中</span>`;
          return `
            <div class="zg-match ${m.done ? "is-done" : ""}">
              <div class="zg-pair">
                <span class="zg-p ${w1}">${escapeHtml(p1?.name || "?")}</span>
                <span class="zg-vs">VS</span>
                <span class="zg-p ${w2}">${escapeHtml(p2?.name || "?")}</span>
              </div>
              <div class="zg-sub">
                <span class="church-tag ${p1?.church || ""}">${churchLabel(p1?.church)}</span>
                <span class="zg-dot">·</span>
                <span class="church-tag ${p2?.church || ""}">${churchLabel(p2?.church)}</span>
                ${score}
              </div>
            </div>`;
        })
        .join('<div class="zg-divider" aria-hidden="true"></div>');

      return `
        <div class="zg-row zone-${zCode}">
          <div class="zg-label zone-${zCode}">
            <span class="zg-letter">${escapeHtml(zCode)}</span>
            <span class="zg-label-text">區</span>
            <span class="zg-label-full">報到 ${escapeHtml(zLab)}</span>
          </div>
          <div class="zg-matches">${matchCells}</div>
        </div>`;
    })
    .join("");

  return `
    <div class="proj-zones">
      <div class="proj-fit-head">
        <div class="proj-fit-title">第 ${round.round} 輪對戰 · 請到自己報到區</div>
      </div>
      <div class="zg-board">${zoneRows}</div>
    </div>`;
}

function renderPairings() {
  const grid = document.getElementById("matchGrid");
  const round = currentRoundObj();
  const badge = document.getElementById("pairRoundBadge");
  const lockBtn = document.getElementById("btnLockRound");
  const regenBtn = document.getElementById("btnRegenPairing");
  const manualBtn = document.getElementById("btnManualPair");
  const progress = document.getElementById("roundProgress");
  const zoneBar = document.getElementById("zoneSummaryBar");
  const panel = document.querySelector(".pairings-panel");

  if (panel) {
    panel.classList.toggle("is-project", pairingsViewMode === "project");
    panel.classList.toggle("is-staff", pairingsViewMode === "staff");
  }
  document.body.classList.toggle(
    "projection-mode",
    pairingsViewMode === "project" && document.getElementById("tab-pairings")?.classList.contains("active")
  );

  if (!round) {
    badge.textContent = "—";
    grid.innerHTML = `<div class="empty"><div class="big">📋</div>尚未開始比賽。請先在「選手」頁完成 ${getTotalPlayers()} 人名單並開始。</div>`;
    lockBtn.disabled = true;
    regenBtn.disabled = true;
    manualBtn.disabled = true;
    progress.textContent = "";
    if (zoneBar) zoneBar.innerHTML = "";
    return;
  }

  if (!round.locked) {
    round.matches = assignMatchZones(round.matches);
  }

  const stations = getActiveStations();
  const settings = normalizeSettings(state.settings);
  badge.textContent = `第 ${round.round} / ${getSwissRounds()} 輪 · ${stations} 站 · ${getTotalPlayers()} 人`;
  const doneCount = round.matches.filter((m) => m.done).length;
  const hintEl = document.getElementById("pairingHint");
  if (hintEl) {
    hintEl.innerHTML = `計分模式：可輸入結果。投影模式會同一畫面列出<strong>全部 ${getTotalPlayers()} 人</strong>的對手同報到區。`;
  }
  progress.textContent =
    pairingsViewMode === "project"
      ? `完成 ${doneCount} / ${round.matches.length} 場`
      : `完成進度：${doneCount} / ${round.matches.length} 場 · 報到站 ${stations}（min 裁判${settings.referees}／對戰盤${settings.stadiums}）`;
  lockBtn.disabled = round.locked || doneCount < round.matches.length;
  lockBtn.textContent =
    round.round >= getSwissRounds()
      ? `鎖定第 ${getSwissRounds()} 輪 · 結算晉級`
      : `鎖定本輪 · 進入第 ${round.round + 1} 輪`;
  regenBtn.disabled = round.locked || state.phase !== "swiss";
  manualBtn.disabled = round.locked || state.phase !== "swiss";

  const byZone = {};
  for (let z = 0; z < stations; z++) byZone[z] = [];
  round.matches.forEach((m) => {
    const z = m.zone != null ? m.zone : 0;
    if (!byZone[z]) byZone[z] = [];
    byZone[z].push(m);
  });

  if (zoneBar) {
    zoneBar.innerHTML = Object.keys(byZone)
      .sort((a, b) => Number(a) - Number(b))
      .map((z) => {
        const list = byZone[z];
        const done = list.filter((m) => m.done).length;
        return `<span class="ds-item zone-chip zone-${zoneCode(Number(z))}"><strong>${zoneLabel(Number(z))}</strong> ${done}/${list.length}</span>`;
      })
      .join("");
  }

  // ── 投影看板模式 ──
  if (pairingsViewMode === "project") {
    grid.innerHTML = renderProjectionBoard(round);
    return;
  }

  // ── 計分操作模式 ──
  const statsMap = {};
  state.players.forEach((p) => {
    statsMap[p.id] = getPlayerStats(p.id);
  });

  grid.innerHTML = Object.keys(byZone)
    .sort((a, b) => Number(a) - Number(b))
    .map((z) => {
      const zNum = Number(z);
      const list = byZone[z];
      return `
        <div class="zone-section zone-${zoneCode(zNum)}">
          <div class="zone-section-header">
            <h3 class="zone-title">📍 ${zoneLabel(zNum)}</h3>
            <span class="meta">${list.length} 場</span>
          </div>
          <div class="match-grid zone-matches">
            ${list.map((m) => renderMatchCardStaff(m, round, statsMap)).join("")}
          </div>
        </div>`;
    })
    .join("");

  const po = state.cutPlayoff;
  if (po?.matches?.length) {
    const poRound = { locked: false, matches: po.matches };
    grid.innerHTML += `
      <div class="zone-block" style="margin-top:18px">
        <div class="zone-block-head">
          <span class="zone-badge">入圍加賽</span>
          <span class="meta">${po.matches.filter((m) => m.done).length} / ${po.matches.length} 場 · 爭 ${po.koN || ""} 強餘額 · ${
            isWinInPlayoff(po) ? "打贏出線" : "打完加本場 BP 再比（打贏唔等於入圍）"
          }</span>
        </div>
        <div class="match-grid zone-matches">
          ${po.matches.map((m) => renderMatchCardStaff(m, poRound, statsMap)).join("")}
        </div>
      </div>`;
  }

  grid.querySelectorAll(".btn-enter-score, .btn-edit-score").forEach((btn) => {
    btn.addEventListener("click", () => openScoreModal(btn.dataset.id));
  });
  grid.querySelectorAll(".btn-clear-score").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("清除此場結果？")) clearMatchResult(btn.dataset.id);
    });
  });
  grid.querySelectorAll(".btn-bey-order").forEach((btn) => {
    btn.addEventListener("click", () => openBeyOrderModal(btn.dataset.id));
  });
}

// ─── 出場次序登記 ────────────────────────────────────────
let beyOrderMatchId = null;

function openBeyOrderModal(matchId) {
  const found = findMatchById(matchId);
  if (!found) {
    toast("搵唔到該場比賽", "error");
    return;
  }
  const { match: m, round } = found;
  ensureMatchBeyOrders(m);
  beyOrderMatchId = matchId;
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  if (!p1 || !p2) return;
  normalizePlayer(p1);
  normalizePlayer(p2);

  const locked = !!round.locked;
  document.getElementById("beyOrderModalTitle").textContent =
    `出場次序 · 場次 ${m.table} · ${p1.name} vs ${p2.name}`;
  document.getElementById("beyOrderModalBody").innerHTML = `
    <div class="hint" style="margin-top:0">
      雙方定<strong>第 1／2／3 場</strong>出場陀螺（用已登記嘅 3 隻）。
      次序<strong>只存於系統、唔會顯示喺對戰表／投影</strong>，避免被人偷睇。
    </div>
    <div class="bey-order-modal-grid">
      ${renderBeyOrderEditor("p1", p1, m.p1BeyOrder, locked)}
      ${renderBeyOrderEditor("p2", p2, m.p2BeyOrder, locked)}
    </div>
    <div class="btn-row wrap mt-16">
      ${
        locked
          ? ""
          : `
        <button type="button" class="btn btn-ghost" id="btnOrderDefault">用登記順序（1→2→3）</button>
        <button type="button" class="btn btn-primary" id="btnSaveBeyOrder" style="margin-left:auto">儲存出場次序</button>
      `
      }
      ${locked ? `<button type="button" class="btn btn-secondary" id="btnCloseBeyOrder2" style="margin-left:auto">關閉</button>` : ""}
    </div>
  `;
  document.getElementById("beyOrderModal").classList.remove("hidden");

  document.getElementById("btnOrderDefault")?.addEventListener("click", () => {
    // 預設：陀螺1→2→3
    for (const side of ["p1", "p2"]) {
      for (let slot = 0; slot < 3; slot++) {
        const sel = document.getElementById(`order-${side}-${slot}`);
        if (sel) sel.value = String(slot);
      }
    }
  });
  document.getElementById("btnSaveBeyOrder")?.addEventListener("click", () => saveBeyOrderFromModal());
  document.getElementById("btnCloseBeyOrder2")?.addEventListener("click", closeBeyOrderModal);
}

function renderBeyOrderEditor(side, player, order, locked) {
  normalizePlayer(player);
  const o = normalizeBeyOrder(order);
  const slotsFixed = [0, 1, 2]
    .map((slot) => {
      const selected = o[slot];
      const opts = [0, 1, 2]
        .map((i) => {
          const lab = beyShortAt(player, i);
          const empty = !lab || lab === "—" || lab === "（未登記）";
          const sel = selected === i ? "selected" : "";
          return `<option value="${i}" ${empty ? "disabled" : ""} ${sel}>陀螺${i + 1}：${escapeHtml(empty ? "（未登記）" : lab)}</option>`;
        })
        .join("");
      return `
        <label class="order-slot">
          <span class="order-slot-num">第 ${slot + 1} 場</span>
          <select class="input select" id="order-${side}-${slot}" ${locked ? "disabled" : ""}>
            <option value="" ${selected === null ? "selected" : ""}>— 選擇陀螺 —</option>
            ${opts}
          </select>
        </label>`;
    })
    .join("");

  return `
    <div class="order-editor">
      <div class="order-editor-head">
        <strong>${escapeHtml(player.name)}</strong>
        <span class="church-tag ${player.church}">${churchLabel(player.church)}</span>
      </div>
      <div class="order-slots">${slotsFixed}</div>
    </div>`;
}

function saveBeyOrderFromModal() {
  const found = findMatchById(beyOrderMatchId);
  if (!found) return;
  const { match: m, round } = found;
  if (round.locked) {
    toast("本輪已鎖定，無法改次序", "error");
    return;
  }

  const readSide = (side) => {
    const arr = [];
    for (let slot = 0; slot < 3; slot++) {
      const el = document.getElementById(`order-${side}-${slot}`);
      const v = el?.value;
      arr.push(v === "" || v === undefined ? null : parseInt(v, 10));
    }
    return normalizeBeyOrder(arr);
  };

  const o1 = readSide("p1");
  const o2 = readSide("p2");

  // 警告重複
  const checkDup = (o, name) => {
    const used = o.filter((x) => x !== null);
    if (used.length !== new Set(used).size) {
      return `${name}：同一隻陀螺用咗超過一次`;
    }
    return null;
  };
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  const d1 = checkDup(o1, p1?.name);
  const d2 = checkDup(o2, p2?.name);
  if (d1 || d2) {
    if (!confirm([d1, d2].filter(Boolean).join("\n") + "\n\n仍要儲存？")) return;
  }

  m.p1BeyOrder = o1;
  m.p2BeyOrder = o2;
  saveState();
  closeBeyOrderModal();
  render();
  toast(
    isBeyOrderComplete(o1) && isBeyOrderComplete(o2)
      ? "雙方出場次序已登記"
      : "已儲存（尚有未定位置）",
    "success"
  );
}

function closeBeyOrderModal() {
  document.getElementById("beyOrderModal")?.classList.add("hidden");
  beyOrderMatchId = null;
}

function applyAdvisedFormat(playerCount) {
  const n = Math.max(2, playerCount | 0);
  const sw = swissRoundsAdvice(n).optimal;
  const ko = getKoBracketSizeFor(n, koSizeAdvice(n).optimal);
  const swEl = document.getElementById("setSwissRounds");
  const koEl = document.getElementById("setKoSize");
  if (koEl) {
    [...koEl.options].forEach((opt) => {
      const v = parseInt(opt.value, 10);
      opt.disabled = v > n;
      opt.hidden = v > n;
    });
    koEl.value = String(ko);
  }
  if (swEl) swEl.value = String(sw);
  toast(`已填入建議：瑞士 ${sw} 輪 · ${ko} 強（記得按儲存設定）`, "success");
  swEl?.dispatchEvent(new Event("change"));
}

function fillSettingsCalculator(playerCount, swissRounds, koSize) {
  const calc = document.getElementById("swissCalcPanel");
  if (!calc) return;
  const { swiss, ko, messages } = warnEventFormat(playerCount, swissRounds, koSize);
  const allowedKo = (ko.allowed || []).join("／") || "4／8／16";
  calc.innerHTML = `
      <div class="swiss-calc">
        <div class="swiss-calc-title">📐 賽制建議</div>
        <div class="swiss-calc-body">
          <p><strong>${swiss.n} 人</strong>建議
          瑞士 <strong class="accent">${swiss.optimal}</strong> 輪 ·
          淘汰 <strong class="accent">${ko.optimal} 強</strong></p>
          <p class="meta">瑞士合理 ${swiss.minOk}–${swiss.maxOk} 輪（理論上限 ${swiss.maxHard}）。
          淘汰可選 ${allowedKo} 強。輪太少排名嘈；輪太多必重賽；淘汰太少則爭席加賽長。
          ${
            playerCount % 2
              ? "單數：平時勝場高者休息；最後一輪先畀已穩入圍／無希望。規則 B 下爭席組要加賽。"
              : ""
          }</p>
          <button type="button" class="btn btn-secondary btn-sm" id="btnApplyOptimalSwiss">套用建議 ${swiss.optimal} 輪 · ${ko.optimal} 強</button>
        </div>
        <div class="swiss-calc-msgs">
          ${messages
            .map(
              (m) =>
                `<div class="swiss-msg swiss-msg-${m.level}">${m.level === "ok" ? "✓" : m.level === "danger" ? "⛔" : "⚠"} ${escapeHtml(m.text)}</div>`
            )
            .join("")}
        </div>
      </div>`;
  document.getElementById("btnApplyOptimalSwiss")?.addEventListener("click", () => {
    applyAdvisedFormat(playerCount);
  });
}

function renderSettings() {
  const s = normalizeSettings(state.settings);
  const refEl = document.getElementById("setReferees");
  const stEl = document.getElementById("setStadiums");
  const swEl = document.getElementById("setSwissRounds");
  const presetEl = document.getElementById("setPlayerPreset");
  const customEl = document.getElementById("setPlayerCountCustom");
  const koEl = document.getElementById("setKoSize");
  const qrEl = document.getElementById("setQualifyRule");
  if (refEl) refEl.value = s.referees;
  if (stEl) stEl.value = s.stadiums;
  if (swEl) swEl.value = s.swissRounds;
  if (presetEl) presetEl.value = s.playerPreset || "16";
  if (customEl) customEl.value = s.playerCount;
  if (koEl) {
    // 只顯示 ≤ 參賽人數嘅選項
    [...koEl.options].forEach((opt) => {
      const v = parseInt(opt.value, 10);
      opt.disabled = v > s.playerCount;
      opt.hidden = v > s.playerCount;
    });
    koEl.value = String(s.koSize);
  }
  if (qrEl) qrEl.value = s.qualifyRule === "B" ? "B" : "A";
  updateQualifyRuleHint(s.qualifyRule);
  syncPlayerCountCustomVisibility();

  const lockedPlayers = state.phase !== "setup";
  if (presetEl) presetEl.disabled = lockedPlayers;
  if (customEl) customEl.disabled = lockedPlayers;

  const stations = getActiveStations();
  const matches = getMatchesPerRound();
  const preview = document.getElementById("settingsPreview");
  fillSettingsCalculator(s.playerCount, s.swissRounds, s.koSize);

  if (preview) {
    const zones = Array.from({ length: stations }, (_, i) => zoneLabel(i)).join("、");
    preview.innerHTML = `
      <div class="hint" style="margin:0">
        <strong>參賽人數：${s.playerCount}</strong>（每輪 ${matches} 場）
        ${s.playerPreset === "other" ? " · 自訂" : ""}<br>
        <strong>可用報到站：${stations}</strong>
        ＝ min(裁判 ${s.referees}，對戰盤 ${s.stadiums}) · 分派：<strong>${zones}</strong><br>
        瑞士制 <strong>${s.swissRounds}</strong> 輪 · 淘汰賽 <strong>${s.koSize} 強</strong> · 入圍 <strong>${qualifyRuleLabel(s.qualifyRule)}</strong>
        ${lockedPlayers ? "<br><span class='meta'>比賽已開始，設定人數唔好喺呢度改；遲到選手請去「選手」頁加入。仍可改裁判／對戰盤／輪次／淘汰名額／入圍規則。</span>" : ""}
      </div>`;
  }
}

const RULES_OPEN_KEY = "baoluo-cup-rules-open";
const RULES_COLLAPSE_IDS = ["rulesBattle", "rulesQualify", "rulesRuleA", "rulesRuleB"];

function renderRules() {
  const rule = getQualifyRule();
  const ready = qualifyEngineReady(rule);
  const badge = document.getElementById("rulesCurrentBadge");
  if (badge) {
    badge.textContent = ready ? `現行：規則 ${rule}` : `已選：規則 ${rule}（尚未套用）`;
  }
  const aEl = document.getElementById("rulesRuleA");
  const bEl = document.getElementById("rulesRuleB");
  aEl?.classList.toggle("rules-current", rule === "A");
  bEl?.classList.toggle("rules-current", rule === "B");
  aEl?.classList.toggle("rules-pending", false);
  bEl?.classList.toggle("rules-pending", rule === "B" && !ready);
}

function bindRulesCollapse() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(RULES_OPEN_KEY) || "{}") || {};
  } catch (_) {
    saved = {};
  }
  RULES_COLLAPSE_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (Object.prototype.hasOwnProperty.call(saved, id)) el.open = !!saved[id];
    el.addEventListener("toggle", persistRulesCollapse);
  });
}

function persistRulesCollapse() {
  try {
    const cur = {};
    RULES_COLLAPSE_IDS.forEach((id) => {
      const n = document.getElementById(id);
      if (n) cur[id] = !!n.open;
    });
    localStorage.setItem(RULES_OPEN_KEY, JSON.stringify(cur));
  } catch (_) {}
}

/** 排名頁：project = 投影大字；detail = 詳細對戰紀錄 */
let standingsViewMode = "project";

function setStandingsViewMode(mode) {
  standingsViewMode = mode === "detail" ? "detail" : "project";
  document.querySelectorAll(".standings-mode-btn").forEach((b) => {
    const on = b.dataset.standingsView === standingsViewMode;
    b.classList.toggle("active", on);
    b.classList.toggle("btn-secondary", on);
    b.classList.toggle("btn-ghost", !on);
  });
  updateProjectionBodyClass();
  renderStandings();
}

/** 對戰表／排名投影時壓縮 chrome，方便一屏睇晒 */
function updateProjectionBodyClass() {
  const tab =
    document.querySelector(".nav-btn.active")?.dataset?.tab ||
    (location.hash || "").replace(/^#/, "") ||
    "";
  const pairProj = tab === "pairings" && pairingsViewMode === "project";
  const standProj = tab === "standings" && standingsViewMode === "project";
  document.body.classList.toggle("projection-mode", pairProj || standProj);
  document.body.classList.toggle("standings-fit", standProj);
}

function renderStandings() {
  const board = document.getElementById("standingsBoard");
  const detailPanel = document.getElementById("standingsDetailPanel");
  const tbody = document.querySelector("#standingsTable tbody");
  const meta = document.getElementById("standingsMeta");

  if (!state.players.length) {
    if (meta) meta.textContent = "";
    if (board) board.innerHTML = `<div class="empty"><div class="big">📊</div>尚未有選手資料</div>`;
    if (tbody) tbody.innerHTML = "";
    if (detailPanel) detailPanel.style.display = standingsViewMode === "detail" ? "" : "none";
    if (board) board.style.display = standingsViewMode === "project" ? "" : "none";
    return;
  }

  const ranked = rankedPlayers();
  const completedRounds = state.rounds.filter((r) => r.locked).length;
  const totalMatches = swissMatchesOnly().length;
  if (meta) {
    meta.textContent = `已鎖定 ${completedRounds} / ${getSwissRounds()} 輪 · ${totalMatches} 場完成`;
  }

  const isProject = standingsViewMode === "project";
  if (board) board.style.display = isProject ? "" : "none";
  if (detailPanel) detailPanel.style.display = isProject ? "none" : "";

  if (isProject) {
    renderStandingsProjection(ranked, completedRounds);
    return;
  }

  // 詳細紀錄表
  if (!tbody) return;
  tbody.innerHTML = ranked
    .map((p) => {
      const log = p.matchLog || [];
      const rec =
        log.length === 0
          ? "—"
          : log
              .map((entry) => {
                const opp = playerById(entry.oppId);
                const wl = entry.won ? "W" : "L";
                const wlClass = entry.won ? "rec-w" : "rec-l";
                return `<span class="rec-item ${wlClass}" title="第${entry.round}輪 vs ${escapeAttr(opp?.name || "?")}">${escapeHtml(opp?.name || "?")} <b>${wl}</b> <span class="rec-score">${entry.myBp}-${entry.oppBp}</span></span>`;
              })
              .join("");
      const qualified = isKoQualified(p.id);
      const front = !isSwissFinishedForKo() && p.rank <= getKoBracketSize() && state.phase !== "setup";
      const status = qualified
        ? '<span class="qualify-badge">晉級</span>'
        : front
          ? "前段"
          : "";
      return `
      <tr class="${qualified || front ? "top4-row" : ""}">
        <td><span class="rank-num ${qualified || front ? "top4" : ""}">${p.rank}${p.tied ? "=" : ""}</span></td>
        <td class="name-cell">${escapeHtml(p.name)}</td>
        <td><span class="church-tag ${p.church}">${churchLabel(p.church)}</span></td>
        <td>${p.wins}</td>
        <td>${p.losses}</td>
        <td><strong>${p.swissPoints}</strong></td>
        <td>${p.battlePoints}</td>
        <td class="record-mini">${rec}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join("");
}

/** 投影排名：雙欄，盡量一屏睇晒 */
function renderStandingsProjection(ranked, completedRounds) {
  const board = document.getElementById("standingsBoard");
  if (!board) return;

  const koN = getKoBracketSize();
  const showQualify =
    completedRounds >= getSwissRounds() ||
    state.phase === "knockout" ||
    state.phase === "done";

  const makeRow = (p) => {
    const qualified = isKoQualified(p.id);
    const top = qualified || (!showQualify && p.rank <= koN);
    const status = qualified
      ? '<span class="sp-badge qualify">晉級</span>'
      : !showQualify && p.rank <= koN
        ? `<span class="sp-badge front">前${koN}</span>`
        : "";
    return `
      <div class="sp-row ${top ? "is-top4" : ""}">
        <div class="sp-rank ${top ? "top4" : ""}">${p.rank}${p.tied ? "=" : ""}</div>
        <div class="sp-player">
          <span class="sp-name">${escapeHtml(p.name)}</span>
          <span class="church-tag ${p.church}">${churchLabel(p.church)}</span>
        </div>
        <div class="sp-wl">
          <span class="sp-wl-num">${p.wins}</span><span class="sp-wl-sep">勝</span>
          <span class="sp-wl-num loss">${p.losses}</span><span class="sp-wl-sep">負</span>
        </div>
        <div class="sp-swiss"><span class="sp-val">${p.swissPoints}</span></div>
        <div class="sp-bp"><span class="sp-val bp">${p.battlePoints}</span></div>
        <div class="sp-status">${status}</div>
      </div>`;
  };

  // 雙欄：左 1–8、右 9–16，每欄 8 行，行高更足、唔裁切
  const mid = Math.ceil(ranked.length / 2);
  const left = ranked.slice(0, mid);
  const right = ranked.slice(mid);
  const rowCount = Math.max(left.length, right.length, 1);

  board.innerHTML = `
    <div class="sp-board sp-board-fit" style="--sp-count:${rowCount}">
      <div class="sp-board-head">
        <div class="sp-board-title">即時排名 · ${ranked.length} 人
          <span class="sp-board-meta">${completedRounds}/${getSwissRounds()} 輪 · 瑞士分＝勝場 · BP＝比賽總分</span>
        </div>
      </div>
      <div class="sp-two-col">
        <div class="sp-col">
          <div class="sp-col-head">
            <span>#</span><span>選手</span><span>戰績</span><span>瑞士</span><span>BP</span><span></span>
          </div>
          <div class="sp-list">${left.map(makeRow).join("")}</div>
        </div>
        <div class="sp-col">
          <div class="sp-col-head">
            <span>#</span><span>選手</span><span>戰績</span><span>瑞士</span><span>BP</span><span></span>
          </div>
          <div class="sp-list">${right.map(makeRow).join("")}</div>
        </div>
      </div>
    </div>`;
}

/** 詳細戰績：每位選手每場 Match 的 Battle 明細 */
function renderHistory() {
  const panel = document.getElementById("historyPanel");
  if (!panel) return;
  if (!state.players.length) {
    panel.innerHTML = `<div class="empty"><div class="big">📖</div>尚未有選手</div>`;
    return;
  }

  const matches = [];
  for (const r of state.rounds) {
    for (const m of r.matches) {
      if (!m.done && !(m.battles && m.battles.length)) continue;
      matches.push({
        ...m,
        round: r.round,
        roundLabel: `第 ${r.round} 輪`,
        tableLabel: m.table != null ? `場次 ${m.table}` : "",
        stage: "swiss",
        sortKey: r.round * 1000 + (m.table || 0),
      });
    }
  }
  // 淘汰賽
  if (state.knockout) {
    let koSort = 100000;
    (state.knockout.rounds || []).forEach((r, ri) => {
      (r.matches || []).forEach((m, mi) => {
        if (!m.done && !(m.battles && m.battles.length)) return;
        matches.push({
          ...m,
          round: `KO${ri}`,
          roundLabel: r.name || "淘汰賽",
          tableLabel: m.label || `場 ${mi + 1}`,
          stage: "ko",
          sortKey: koSort + ri * 100 + mi,
        });
      });
    });
    if (state.knockout.semis) {
      state.knockout.semis.forEach((m, mi) => {
        if (!m.done && !(m.battles && m.battles.length)) return;
        matches.push({
          ...m,
          round: "KO-S",
          roundLabel: "準決賽",
          tableLabel: m.label || `場 ${mi + 1}`,
          stage: "ko",
          sortKey: koSort + 500 + mi,
        });
      });
    }
    [["third", "季軍賽"], ["final", "決賽"]].forEach(([key, lab], i) => {
      const m = state.knockout[key];
      if (!m) return;
      if (!m.done && !(m.battles && m.battles.length)) return;
      matches.push({
        ...m,
        round: "KO-" + key,
        roundLabel: lab,
        tableLabel: m.label || lab,
        stage: "ko",
        sortKey: koSort + 800 + i,
      });
    });
  }

  if (!matches.length) {
    panel.innerHTML = `<div class="empty"><div class="big">📖</div>完成比賽並記錄 Battle 後，詳細戰績會顯示於此（含淘汰賽）。</div>`;
    return;
  }

  const byPlayer = state.players.map((p) => {
    normalizePlayer(p);
    const mine = matches
      .filter((m) => m.p1 === p.id || m.p2 === p.id)
      .sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0));
    return { player: p, matches: mine };
  });

  panel.innerHTML = byPlayer
    .map(({ player: p, matches: mine }) => {
      if (!mine.length) {
        return `
          <div class="hist-player">
            <div class="hist-player-head">
              <strong>${escapeHtml(p.name)}</strong>
              <span class="church-tag ${p.church}">${churchLabel(p.church)}</span>
              <span class="meta">未有完場紀錄</span>
            </div>
          </div>`;
      }
      const blocks = mine
        .map((m) => {
          const oppId = m.p1 === p.id ? m.p2 : m.p1;
          const opp = playerById(oppId);
          const myBp = m.p1 === p.id ? m.p1Bp : m.p2Bp;
          const oppBp = m.p1 === p.id ? m.p2Bp : m.p1Bp;
          const isBye = isByeMatch(m);
          const matchDone = !!m.done;
          const won = matchDone && m.winner === p.id;
          ensureMatchBeyOrders(m);
          const battles = normalizeBattles(m.battles || []);
          let battleHtml;
          if (battles.length) {
            battleHtml = battles
              .map((b, i) => {
                const myBeyI = m.p1 === p.id ? b.p1BeyIndex : b.p2BeyIndex;
                const oppBeyI = m.p1 === p.id ? b.p2BeyIndex : b.p1BeyIndex;
                const myBey = beyShortAt(p, myBeyI);
                const oppBey = beyShortAt(opp, oppBeyI);
                const iWon = b.winnerId === p.id;
                const pts = b.points || finishPts(b.finishType);
                return `
                  <div class="hist-battle ${iWon ? "win" : "lose"}">
                    <span class="hist-b-num">B${i + 1}</span>
                    <span class="hist-b-bey">${escapeHtml(myBey)} <span class="muted">vs</span> ${escapeHtml(oppBey)}</span>
                    <span class="hist-b-res">${iWon ? `勝 +${pts}` : "負 0"} · ${escapeHtml(finishLabel(b.finishType))}</span>
                  </div>`;
              })
              .join("");
          } else {
            battleHtml = `<div class="meta">舊資料：只有總分 ${myBp}–${oppBp}（無逐場 Battle）</div>`;
          }
          const resultCls = !matchDone ? "hist-live" : won ? "hist-win" : "hist-lose";
          let resultTxt;
          if (!matchDone) resultTxt = `進行中 ${myBp}–${oppBp}`;
          else if (m.lateSitLoss) resultTxt = "負 0–4（遲到坐場）";
          else if (isBye) resultTxt = "自動獲勝";
          else if (m.lateForfeit) resultTxt = `${won ? "勝" : "負"} ${myBp}–${oppBp}（遲到 0–4）`;
          else resultTxt = `${won ? "勝" : "負"} ${myBp}–${oppBp}`;
          const oppLabel = isBye ? "（無對手）" : opp?.name || "?";
          const headLeft = m.stage === "ko"
            ? `${escapeHtml(m.roundLabel)}${m.tableLabel ? " · " + escapeHtml(m.tableLabel) : ""}`
            : `${escapeHtml(m.roundLabel)}${m.tableLabel ? " · " + escapeHtml(m.tableLabel) : ""}`;
          return `
            <div class="hist-match ${matchDone ? "" : "is-live"} ${m.stage === "ko" ? "is-ko" : ""}">
              <div class="hist-match-head">
                <span>${headLeft}</span>
                <span>vs <strong>${escapeHtml(oppLabel)}</strong></span>
                <span class="${resultCls}">${resultTxt}</span>
              </div>
              <div class="hist-battles">${battleHtml}</div>
            </div>`;
        })
        .join("");

      return `
        <div class="hist-player">
          <div class="hist-player-head">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="church-tag ${p.church}">${churchLabel(p.church)}</span>
            <span class="meta">${mine.length} 場 Match</span>
          </div>
          ${blocks}
        </div>`;
    })
    .join("");
}

function renderTies() {
  const panel = document.getElementById("tieBreakPanel");
  if (!state.players.length || !swissMatchesOnly().length) {
    panel.innerHTML = `<div class="empty"><div class="big">⚖️</div>完成部分比賽後，同分情況會顯示於此。</div>`;
    return;
  }

  const ranked = rankedPlayers();
  // Group by swiss points
  const groups = {};
  for (const p of ranked) {
    groups[p.swissPoints] = groups[p.swissPoints] || [];
    groups[p.swissPoints].push(p);
  }

  const multi = Object.entries(groups)
    .filter(([, arr]) => arr.length >= 2)
    .sort((a, b) => Number(b[0]) - Number(a[0]));

  if (!multi.length) {
    panel.innerHTML = `<div class="empty">目前沒有瑞士積分相同的選手。</div>`;
    return;
  }

  const ctx = getCutoffContext();
  const plan = describeCutoffPlan(ctx);
  let cutoffHtml = "";
  if (ctx.needed) {
    const poDone = cutPlayoffComplete();
    const ready = poDone || (plan.resolved && !plan.needsMatches);
    cutoffHtml = `
      <div class="tie-group" style="border-color:rgba(200,255,0,0.45)">
        <h3>入圍加賽 · 最後 ${ctx.spots} 席「${ctx.koN} 強」</h3>
        <div class="tie-result">${plan.lines.map((t) => `• ${escapeHtml(t)}`).join("<br>")}</div>
        <p class="hint" style="margin-top:10px">入圍規則：<strong>${escapeHtml(qualifyRuleLabel(getQualifyRule()))}</strong>。${
          getQualifyRule() === "B"
            ? "獎勵壓制：淨勝分先於總 BP。而家雙數可先用紙上分；而家單數扣坐場分後爭席組加賽。<strong>打贏就入圍</strong>。單數開場後加人變雙數：仍然扣過往自動勝，但改行紙上。種子選手／種子線跟淨勝分（再總 BP、對賽、登記陀螺 T0×2+T1×1）。"
            : "入圍同種子分開。不同自動獲勝次數唔直接用瑞士總 BP 比。加賽多數情況：先到 4（最多 6），打完加本場 BP 再比，<strong>打贏唔等於入圍</strong>。5 人以上真同分先至抽籤小型淘汰（打贏出線）。"
        }</p>
        <div class="btn-row wrap mt-16">
          ${
            ready
              ? `<span class="meta">${plan.needsMatches ? "加賽已完成" : "無需加賽"}，可去淘汰賽頁產生 bracket。</span>`
              : `<button type="button" class="btn btn-primary" id="btnGenCutoffPlayoff">${
                  state.cutPlayoff?.matches?.length ? "重新產生入圍加賽" : "產生入圍加賽"
                }</button>`
          }
        </div>
      </div>`;
  }

  panel.innerHTML = cutoffHtml + multi
    .map(([sp, arr]) => {
      // Build H2H matrix
      let matrix = `<table class="tie-matrix"><thead><tr><th></th>${arr
        .map((p) => `<th>${escapeHtml(p.name)}</th>`)
        .join("")}<th>總分</th></tr></thead><tbody>`;
      for (const a of arr) {
        matrix += `<tr><th>${escapeHtml(a.name)}</th>`;
        for (const b of arr) {
          if (a.id === b.id) {
            matrix += `<td>—</td>`;
          } else {
            const w = headToHead(a.id, b.id);
            if (!w) matrix += `<td style="color:var(--muted)">未對賽</td>`;
            else if (w === a.id) matrix += `<td style="color:var(--success);font-weight:800">勝</td>`;
            else matrix += `<td style="color:var(--danger)">負</td>`;
          }
        }
        matrix += `<td><strong>${a.battlePoints}</strong></td></tr>`;
      }
      matrix += `</tbody></table>`;

      // Explain resolution
      const lines = [];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          const w = headToHead(a.id, b.id);
          if (w) {
            lines.push(`• <strong>${escapeHtml(playerById(w).name)}</strong> 曾擊敗 ${escapeHtml(playerById(w === a.id ? b.id : a.id).name)}（對賽成績優先）`);
          } else if (a.battlePoints !== b.battlePoints) {
            const better = a.battlePoints > b.battlePoints ? a : b;
            const worse = better.id === a.id ? b : a;
            lines.push(
              `• ${escapeHtml(a.name)} 與 ${escapeHtml(b.name)} 未對賽 → 比賽總分 ${a.battlePoints} vs ${b.battlePoints}，<strong>${escapeHtml(better.name)}</strong> 較高`
            );
          } else {
            lines.push(
              `• <span class="need-playoff">⚠ ${escapeHtml(a.name)} 與 ${escapeHtml(b.name)}：未對賽且總分同為 ${a.battlePoints} → 需要加賽（先到 4 分）</span>`
            );
          }
        }
      }

      return `
      <div class="tie-group">
        <h3>瑞士積分 <span class="swiss-label">${sp} 分</span> · ${arr.length} 人</h3>
        ${matrix}
        <div class="tie-result">${lines.join("<br>") || "—"}</div>
      </div>`;
    })
    .join("");

  document.getElementById("btnGenCutoffPlayoff")?.addEventListener("click", () => {
    if (state.cutPlayoff?.matches?.some((m) => m.done)) {
      if (!confirm("已有加賽結果。重新產生會清掉，確定？")) return;
    }
    generateCutoffPlayoff();
  });
}

function renderKnockout() {
  const box = document.getElementById("knockoutBracket");
  const btn = document.getElementById("btnStartKnockout");
  const btnRedo = document.getElementById("btnRedoKnockout");
  const settingsKo = getKoBracketSize();
  const koN = getEffectiveKoSize();
  const titleEl = document.getElementById("knockoutTitle");
  if (titleEl) {
    titleEl.textContent = state.knockout
      ? `淘汰賽（${koN} 強）`
      : `淘汰賽（設定 ${settingsKo} 強）`;
  }
  if (btn) {
    btn.textContent = state.knockout ? `${koN} 強進行中` : `產生 ${settingsKo} 強配對`;
  }
  if (btnRedo) {
    btnRedo.style.display = state.knockout ? "" : "none";
    btnRedo.disabled = !state.knockout;
  }

  const need = getSwissRounds();
  const relevant = state.rounds.filter((r) => r.round <= need);
  const swissReady = relevant.length >= need && relevant.every((r) => r.locked);
  if (btn) {
    if (state.knockout) btn.disabled = true;
    else btn.disabled = !swissReady;
  }

  if (!state.knockout) {
    box.innerHTML = swissReady
      ? `<div class="empty"><div class="big">🏆</div>瑞士制已完成（${need} 輪）。按上方按鈕產生 <strong>${settingsKo} 強</strong>（第1 vs 第${settingsKo}、第2 vs 第${settingsKo - 1}…）。</div>`
      : `<div class="empty"><div class="big">🏆</div>完成 ${need} 輪瑞士制後可產生 ${settingsKo} 強淘汰賽。</div>`;
    return;
  }

  const renderKoMatch = (m, type, roundIndex, matchIndex) => {
    if (!m) return "";
    const p1 = playerById(m.p1);
    const p2 = playerById(m.p2);
    const dataAttrs =
      type === "round"
        ? `data-type="round" data-round="${roundIndex}" data-index="${matchIndex}"`
        : type === "semi"
          ? `data-type="semi" data-index="${matchIndex}"`
          : `data-type="${type}" data-index=""`;
    return `
      <div class="ko-match ${m.done ? "done" : ""}">
        <div class="match-top">
          <strong>${escapeHtml(m.label)}</strong>
          ${m.done ? `<span class="vs-tag diff">勝：${escapeHtml(playerById(m.winner)?.name || "")}</span>` : ""}
        </div>
        <div class="match-players" style="margin:10px 0">
          <div class="player-side ${m.done && m.winner === m.p1 ? "winner" : ""}">
            <div class="p-name">${escapeHtml(p1?.name || "")}</div>
            <div class="p-meta"><span class="church-tag ${p1?.church}">${churchLabel(p1?.church)}</span></div>
            ${m.done ? `<div class="p-bp">${m.p1Bp}</div>` : ""}
          </div>
          <div class="vs-center">VS</div>
          <div class="player-side ${m.done && m.winner === m.p2 ? "winner" : ""}">
            <div class="p-name">${escapeHtml(p2?.name || "")}</div>
            <div class="p-meta"><span class="church-tag ${p2?.church}">${churchLabel(p2?.church)}</span></div>
            ${m.done ? `<div class="p-bp">${m.p2Bp}</div>` : ""}
          </div>
        </div>
        ${
          m.done
            ? `<button class="btn btn-secondary btn-sm btn-ko-edit" ${dataAttrs}>修改</button>`
            : `<button class="btn btn-primary btn-sm btn-ko-score" ${dataAttrs}>輸入結果</button>`
        }
      </div>`;
  };

  let html = "";
  const rounds = state.knockout.rounds || [];
  rounds.forEach((r, ri) => {
    html += `<div class="ko-round"><h3>${escapeHtml(r.name || `第 ${ri + 1} 輪`)}</h3>`;
    (r.matches || []).forEach((m, mi) => {
      html += renderKoMatch(m, "round", ri, mi);
    });
    html += `</div>`;
  });

  // 相容舊 semis
  if (!rounds.length && state.knockout.semis) {
    html += `<div class="ko-round"><h3>準決賽</h3>`;
    state.knockout.semis.forEach((m, i) => {
      html += renderKoMatch(m, "semi", 0, i);
    });
    html += `</div>`;
  }

  if (state.knockout.third || state.knockout.final) {
    html += `<div class="ko-round"><h3>季軍賽 / 決賽</h3>`;
    if (state.knockout.third) html += renderKoMatch(state.knockout.third, "third");
    if (state.knockout.final) html += renderKoMatch(state.knockout.final, "final");
    html += `</div>`;
  }

  if (state.phase === "done" && state.knockout.final?.done) {
    const champ = playerById(state.knockout.final.winner);
    const runner = playerById(
      state.knockout.final.p1 === state.knockout.final.winner
        ? state.knockout.final.p2
        : state.knockout.final.p1
    );
    const third = state.knockout.third?.done ? playerById(state.knockout.third.winner) : null;
    html += `<div class="ko-round" style="border-color:#fbbf24">
      <h3 style="color:#fbbf24">最終名次</h3>
      <p style="font-size:1.2rem;font-weight:800;margin:8px 0">🥇 冠軍：${escapeHtml(champ?.name || "")}</p>
      <p style="font-size:1.1rem;font-weight:700">🥈 亞軍：${escapeHtml(runner?.name || "")}</p>
      ${third ? `<p style="font-size:1.05rem;font-weight:700">🥉 季軍：${escapeHtml(third.name)}</p>` : ""}
    </div>`;
  }

  box.innerHTML = html;

  box.querySelectorAll(".btn-ko-score, .btn-ko-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const roundIndex = btn.dataset.round !== undefined ? Number(btn.dataset.round) : undefined;
      const index = btn.dataset.index === "" || btn.dataset.index === undefined ? undefined : Number(btn.dataset.index);
      openKoScoreModal(type, index, roundIndex);
    });
  });
}

// ─── 抽籤 ────────────────────────────────────────────────
let drawRolling = false;

function drawChurchLabel(id) {
  if (id === "out") return "場外";
  return churchLabel(id);
}

function drawPool() {
  const d = ensureDraw();
  const excluded = new Set(d.excludedPlayerIds);
  const taken = new Set((d.results || []).map((r) => r.winnerKey));
  const list = [];
  for (const p of state.players) {
    const key = "p:" + p.id;
    if (excluded.has(p.id) || taken.has(key)) continue;
    list.push({ key, id: p.id, name: p.name, church: p.church, source: "player" });
  }
  for (const e of d.extras) {
    const key = "e:" + e.id;
    if (taken.has(key)) continue;
    list.push({ key, id: e.id, name: e.name, church: e.church || "out", source: "extra" });
  }
  return list;
}

function nextUndrawnPrize() {
  const d = ensureDraw();
  const drawn = new Set(d.results.map((r) => r.prizeId));
  return d.prizes.find((p) => !drawn.has(p.id)) || null;
}

function addDrawExtra() {
  if (!assertCanWrite()) return;
  const name = document.getElementById("drawExtraName")?.value.trim();
  if (!name) {
    toast("請輸入姓名", "error");
    return;
  }
  const church = getSelectedChurch("#drawExtraChurch") || "out";
  const d = ensureDraw();
  d.extras.push({ id: uid("dx"), name, church });
  document.getElementById("drawExtraName").value = "";
  saveState();
  renderDraw();
  toast(`已加入 ${name}`, "success");
}

function addDrawPrize() {
  if (!assertCanWrite()) return;
  const name = document.getElementById("drawPrizeName")?.value.trim();
  if (!name) {
    toast("請輸入獎品名稱", "error");
    return;
  }
  const d = ensureDraw();
  d.prizes.push({ id: uid("prize"), name });
  document.getElementById("drawPrizeName").value = "";
  saveState();
  renderDraw();
  toast(`已加入獎品「${name}」`, "success");
}

function setDrawPlayerIncluded(playerId, included) {
  if (!assertCanWrite()) return;
  const d = ensureDraw();
  const set = new Set(d.excludedPlayerIds);
  if (included) set.delete(playerId);
  else set.add(playerId);
  d.excludedPlayerIds = [...set];
  saveState();
  renderDraw();
}

function removeDrawExtra(id) {
  if (!assertCanWrite()) return;
  const d = ensureDraw();
  d.extras = d.extras.filter((e) => e.id !== id);
  saveState();
  renderDraw();
}

function removeDrawPrize(id) {
  if (!assertCanWrite()) return;
  const d = ensureDraw();
  if (d.results.some((r) => r.prizeId === id)) {
    toast("已抽出嘅獎品請用「重抽」或先清除結果", "error");
    return;
  }
  d.prizes = d.prizes.filter((p) => p.id !== id);
  saveState();
  renderDraw();
}

function resetDrawResults() {
  if (!assertCanWrite()) return;
  const d = ensureDraw();
  if (!d.results.length) {
    toast("未有抽出結果", "error");
    return;
  }
  if (!confirm("清除全部抽出結果？名單同獎品會保留。")) return;
  d.results = [];
  saveState();
  renderDraw();
  toast("已清除抽出結果", "success");
}

function redrawPrize(prizeId) {
  if (!assertCanWrite() || drawRolling) return;
  const d = ensureDraw();
  const before = d.results.length;
  d.results = d.results.filter((r) => r.prizeId !== prizeId);
  if (d.results.length === before) return;
  saveState();
  runDrawForPrize(prizeId);
}

function drawNextPrize() {
  if (!assertCanWrite() || drawRolling) return;
  const prize = nextUndrawnPrize();
  if (!prize) {
    toast(ensureDraw().prizes.length ? "獎品已全部抽出" : "請先加入獎品", "error");
    return;
  }
  runDrawForPrize(prize.id);
}

function runDrawForPrize(prizeId) {
  const d = ensureDraw();
  const prize = d.prizes.find((p) => p.id === prizeId);
  if (!prize) return;
  const pool = drawPool();
  if (!pool.length) {
    toast("名單已空，無法抽出", "error");
    renderDraw();
    return;
  }
  const winner = pool[Math.floor(Math.random() * pool.length)];
  const reveal = document.getElementById("drawReveal");
  const nameEl = document.getElementById("drawRevealName");
  const prizeEl = document.getElementById("drawRevealPrize");
  drawRolling = true;
  if (prizeEl) prizeEl.textContent = prize.name;
  const commit = () => {
    const cur = ensureDraw();
    cur.results.push({
      prizeId: prize.id,
      prizeName: prize.name,
      winnerKey: winner.key,
      winnerName: winner.name,
      church: winner.church,
      at: new Date().toISOString(),
    });
    saveState();
    drawRolling = false;
    renderDraw();
    const box = document.getElementById("drawReveal");
    box?.classList.add("landed");
    toast(`${prize.name} → ${winner.name}`, "success");
    setTimeout(() => box?.classList.remove("landed"), 1800);
  };
  if (!reveal) {
    commit();
    return;
  }
  reveal.classList.remove("idle", "landed", "landing");
  reveal.classList.add("rolling");
  if (nameEl) nameEl.textContent = pool[0].name;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduced) {
    if (nameEl) nameEl.textContent = winner.name;
    reveal.classList.remove("rolling");
    commit();
    return;
  }
  const bey = reveal.querySelector(".draw-bey");
  if (bey) {
    bey.getAnimations?.().forEach((a) => a.cancel());
    bey.style.transform = "";
    bey.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(2520deg)" }], {
      duration: 2400,
      easing: "cubic-bezier(0.05, 0.62, 0.18, 1)",
      fill: "forwards",
    });
  }
  let step = 0;
  const total = 30;
  const tick = () => {
    step++;
    if (nameEl) nameEl.textContent = step >= total ? winner.name : pool[step % pool.length].name;
    if (step >= total) {
      reveal.classList.remove("rolling");
      commit();
      return;
    }
    setTimeout(tick, 40 + Math.pow(step / total, 2.4) * 160);
  };
  tick();
}

function renderDraw() {
  const d = ensureDraw();
  const pool = drawPool();
  const countEl = document.getElementById("drawPoolCount");
  if (countEl) countEl.textContent = `${pool.length} 人可抽`;

  const playerList = document.getElementById("drawPlayerList");
  if (playerList) {
    if (!state.players.length) {
      playerList.innerHTML = `<div class="meta">尚未有參賽選手。加入選手後會自動列入抽籤名單。</div>`;
    } else {
      const excluded = new Set(d.excludedPlayerIds);
      const taken = new Set(d.results.map((r) => r.winnerKey));
      playerList.innerHTML = state.players
        .map((p) => {
          const key = "p:" + p.id;
          const won = taken.has(key);
          const on = !excluded.has(p.id);
          return `<label class="draw-row ${won ? "won" : ""} ${on ? "" : "off"}">
            <input type="checkbox" data-draw-player="${escapeHtml(p.id)}" ${on ? "checked" : ""} ${won ? "disabled" : ""} />
            <span class="draw-name">${escapeHtml(p.name)}</span>
            <span class="church-tag ${p.church}">${churchLabel(p.church)}</span>
            ${won ? `<span class="meta">已抽出</span>` : ""}
          </label>`;
        })
        .join("");
    }
  }

  const extraList = document.getElementById("drawExtraList");
  if (extraList) {
    if (!d.extras.length) {
      extraList.innerHTML = `<div class="meta">未有場外名單。</div>`;
    } else {
      const taken = new Set(d.results.map((r) => r.winnerKey));
      extraList.innerHTML = d.extras
        .map((e) => {
          const won = taken.has("e:" + e.id);
          return `<div class="draw-row ${won ? "won" : ""}">
            <span class="draw-name">${escapeHtml(e.name)}</span>
            <span class="church-tag ${e.church === "out" ? "" : e.church}">${drawChurchLabel(e.church)}</span>
            ${won ? `<span class="meta">已抽出</span>` : `<button type="button" class="btn-icon" data-draw-del-extra="${escapeHtml(e.id)}" title="移出名單">✕</button>`}
          </div>`;
        })
        .join("");
    }
  }

  const prizeList = document.getElementById("drawPrizeList");
  if (prizeList) {
    if (!d.prizes.length) {
      prizeList.innerHTML = `<div class="meta">尚未加入獎品。</div>`;
    } else {
      const byPrize = new Map(d.results.map((r) => [r.prizeId, r]));
      prizeList.innerHTML = d.prizes
        .map((p, i) => {
          const r = byPrize.get(p.id);
          return `<div class="draw-prize ${r ? "done" : ""}">
            <div>
              <strong>${i + 1}. ${escapeHtml(p.name)}</strong>
              ${r ? `<div class="meta">→ ${escapeHtml(r.winnerName)}</div>` : ""}
            </div>
            <div class="btn-row">
              ${
                r
                  ? `<button type="button" class="btn btn-ghost btn-sm" data-draw-redraw="${escapeHtml(p.id)}">重抽</button>`
                  : `<button type="button" class="btn btn-secondary btn-sm" data-draw-one="${escapeHtml(p.id)}">抽出</button>
                     <button type="button" class="btn-icon" data-draw-del-prize="${escapeHtml(p.id)}" title="刪除">✕</button>`
              }
            </div>
          </div>`;
        })
        .join("");
    }
  }

  const results = document.getElementById("drawResults");
  if (results) {
    if (!d.results.length) {
      results.innerHTML = `<div class="meta">尚未抽出。</div>`;
    } else {
      results.innerHTML = `<ol class="draw-result-list">${d.results
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.prizeName)}</strong> → ${escapeHtml(r.winnerName)}
              <span class="church-tag ${r.church === "out" ? "" : r.church || ""}">${drawChurchLabel(r.church)}</span></li>`
        )
        .join("")}</ol>`;
    }
  }

  const reveal = document.getElementById("drawReveal");
  const nameEl = document.getElementById("drawRevealName");
  const prizeEl = document.getElementById("drawRevealPrize");
  if (reveal && !drawRolling) {
    const last = d.results[d.results.length - 1];
    if (nameEl) nameEl.textContent = last ? last.winnerName : "—";
    if (prizeEl) prizeEl.textContent = last ? last.prizeName : "";
    reveal.classList.remove("rolling", "landing", "landed");
    reveal.classList.toggle("idle", !last);
  }

  const nextBtn = document.getElementById("btnDrawNext");
  if (nextBtn) {
    const next = nextUndrawnPrize();
    nextBtn.disabled = drawRolling || !next || !drawPool().length;
    nextBtn.textContent = next ? `抽出：${next.name}` : d.prizes.length ? "已全部抽出" : "抽出下一項";
  }
}

function bindDrawUi() {
  document.getElementById("btnDrawAddExtra")?.addEventListener("click", addDrawExtra);
  document.getElementById("drawExtraName")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDrawExtra();
  });
  document.getElementById("btnDrawAddPrize")?.addEventListener("click", addDrawPrize);
  document.getElementById("drawPrizeName")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDrawPrize();
  });
  document.getElementById("btnDrawNext")?.addEventListener("click", drawNextPrize);
  document.getElementById("btnDrawResetResults")?.addEventListener("click", resetDrawResults);

  const extraChurch = document.getElementById("drawExtraChurch");
  if (extraChurch) {
    syncChurchCheckStyles(extraChurch);
    extraChurch.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener("change", () => syncChurchCheckStyles(extraChurch));
    });
  }

  const tab = document.getElementById("tab-draw");
  tab?.addEventListener("change", (e) => {
    const id = e.target?.dataset?.drawPlayer;
    if (!id) return;
    setDrawPlayerIncluded(id, !!e.target.checked);
  });
  tab?.addEventListener("click", (e) => {
    const t = e.target.closest("[data-draw-del-extra],[data-draw-del-prize],[data-draw-one],[data-draw-redraw]");
    if (!t) return;
    if (t.dataset.drawDelExtra) removeDrawExtra(t.dataset.drawDelExtra);
    else if (t.dataset.drawDelPrize) removeDrawPrize(t.dataset.drawDelPrize);
    else if (t.dataset.drawOne) {
      if (drawRolling) return;
      runDrawForPrize(t.dataset.drawOne);
    } else if (t.dataset.drawRedraw) redrawPrize(t.dataset.drawRedraw);
  });
}

// ─── Score Modal ─────────────────────────────────────────
let scoreModalMatchId = null;
let scoreModalWinner = null;
let scoreModalP1Id = null;
let scoreModalP2Id = null;
let koModalRef = null;

/**
 * 官方：先到 4 分即勝。每場 Battle 只有一方得分（同時完場＝該場無分）。
 * 正常記錄唔會出現 4–4；若總分相同則 Match 無分（兩邊都唔記瑞士勝）。
 */
function autoWinnerFromScores(p1Id, p2Id, p1Bp, p2Bp) {
  const a = Math.max(0, parseInt(p1Bp, 10) || 0);
  const b = Math.max(0, parseInt(p2Bp, 10) || 0);
  if (a >= MATCH_TARGET && a > b) return p1Id;
  if (b >= MATCH_TARGET && b > a) return p2Id;
  return null;
}

/** 計分 modal 草稿 battles（瑞士制逐場記錄） */
let scoreBattleDraft = [];

function openScoreModal(matchId) {
  const found = findMatchById(matchId);
  const m = found?.match;
  if (!m) return;
  if (m.lateForfeit) {
    toast("遲到對戰已自動 0–4，無需輸入結果", "error");
    return;
  }
  ensureMatchBeyOrders(m);
  scoreModalMatchId = matchId;
  koModalRef = null;
  scoreModalP1Id = m.p1;
  scoreModalP2Id = m.p2;
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  // 有舊總分但無 battles → 保留總分快速模式；有 battles 用明細
  scoreBattleDraft = normalizeBattles(m.battles || []);
  if (!scoreBattleDraft.length && (m.p1Bp > 0 || m.p2Bp > 0) && m.done) {
    // 相容舊資料：無明細時用總分表單
    scoreModalWinner = m.winner || autoWinnerFromScores(m.p1, m.p2, m.p1Bp, m.p2Bp);
    document.getElementById("scoreModalTitle").textContent = `場次 ${m.table} · 輸入結果`;
    document.getElementById("scoreModalBody").innerHTML = buildScoreFormSimple(p1, p2, m.p1Bp, m.p2Bp);
    document.getElementById("scoreModal").classList.remove("hidden");
    bindScoreFormSimple(async () => {
      const p1Bp = document.getElementById("scoreP1").value;
      const p2Bp = document.getElementById("scoreP2").value;
      // 唔沿用舊 scoreModalWinner：每次按分數重新判定（4–4 開 modal）
      let winner = await resolveWinnerForScores(scoreModalP1Id, scoreModalP2Id, p1Bp, p2Bp);
      scoreModalWinner = winner;
      m.battles = [];
      if (saveMatchResult(scoreModalMatchId, scoreModalWinner, p1Bp, p2Bp)) closeScoreModal();
    });
    return;
  }

  document.getElementById("scoreModalTitle").textContent = `場次 ${m.table} · Battle 紀錄`;
  document.querySelector("#scoreModal .modal-card")?.classList.add("modal-wide");
  renderBattleScoreModal(p1, p2, m);
  document.getElementById("scoreModal").classList.remove("hidden");
}

function openKoScoreModal(type, index, roundIndex) {
  if (!state.knockout) {
    toast("尚未產生淘汰賽", "error");
    return;
  }
  const idx = index === undefined || index === null || index === "" ? null : Number(index);
  const ri = roundIndex === undefined || roundIndex === null || roundIndex === "" ? null : Number(roundIndex);
  let matchRef;
  if (type === "round") matchRef = { type: "round", roundIndex: ri, matchIndex: idx };
  else if (type === "semi") matchRef = { type: "semi", index: idx };
  else if (type === "third") matchRef = { type: "third" };
  else if (type === "final") matchRef = { type: "final" };
  else matchRef = { type, index: idx };

  const m = getKoMatch(matchRef);
  if (!m) {
    toast("搵唔到該場比賽", "error");
    return;
  }
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  if (!p1 || !p2) {
    toast("選手資料缺失", "error");
    return;
  }

  scoreModalMatchId = null;
  koModalRef = matchRef;
  scoreModalP1Id = m.p1;
  scoreModalP2Id = m.p2;
  // 淘汰賽：用 battle 明細（若已有）或簡單總分
  if (!m.battles) m.battles = [];
  scoreBattleDraft = normalizeBattles(m.battles);
  if (scoreBattleDraft.length || !m.done) {
    // 統一用 battle UI（可逐步加）
    document.getElementById("scoreModalTitle").textContent = (m.label || "淘汰賽") + " · Battle 紀錄";
    document.querySelector("#scoreModal .modal-card")?.classList.add("modal-wide");
    renderBattleScoreModal(p1, p2, m, { knockout: true });
    document.getElementById("scoreModal").classList.remove("hidden");
    return;
  }
  scoreModalWinner = m.winner || autoWinnerFromScores(m.p1, m.p2, m.p1Bp, m.p2Bp);
  document.getElementById("scoreModalTitle").textContent = m.label || "淘汰賽結果";
  document.querySelector("#scoreModal .modal-card")?.classList.remove("modal-wide");
  document.getElementById("scoreModalBody").innerHTML = buildScoreFormSimple(p1, p2, m.p1Bp || 0, m.p2Bp || 0);
  document.getElementById("scoreModal").classList.remove("hidden");
  bindScoreFormSimple(async () => {
    const p1Bp = document.getElementById("scoreP1").value;
    const p2Bp = document.getElementById("scoreP2").value;
    let winner = await resolveWinnerForScores(scoreModalP1Id, scoreModalP2Id, p1Bp, p2Bp);
    scoreModalWinner = winner;
    if (saveKoResult(koModalRef, scoreModalWinner, p1Bp, p2Bp)) closeScoreModal();
  });
}

function renderBattleScoreModal(p1, p2, m, opts = {}) {
  const body = document.getElementById("scoreModalBody");
  normalizePlayer(p1);
  normalizePlayer(p2);
  ensureMatchBeyOrders(m);
  const t = totalsFromBattles(p1.id, p2.id, scoreBattleDraft);
  const totals = t;

  const battleRows = scoreBattleDraft
    .map((b, i) => {
      const wName = b.winnerId === p1.id ? p1.name : b.winnerId === p2.id ? p2.name : "?";
      const lName = b.winnerId === p1.id ? p2.name : p1.name;
      const b1 = beyShortAt(p1, b.p1BeyIndex);
      const b2 = beyShortAt(p2, b.p2BeyIndex);
      return `
        <div class="battle-log-row">
          <div class="battle-log-num">第 ${i + 1} 場</div>
          <div class="battle-log-body">
            <div class="battle-log-bey">${escapeHtml(b1)} <span class="muted">vs</span> ${escapeHtml(b2)}</div>
            <div class="battle-log-res">
              <strong>${escapeHtml(wName)}</strong> 勝
              · ${escapeHtml(finishLabel(b.finishType))}
              · +${b.points || finishPts(b.finishType)} 分
              <span class="muted">（${escapeHtml(lName)} 0 分）</span>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm battle-del" data-i="${i}">刪</button>
        </div>`;
    })
    .join("");

  const nextI = scoreBattleDraft.length;
  const def1 = defaultBeyIndexForBattle(m.p1BeyOrder, nextI);
  const def2 = defaultBeyIndexForBattle(m.p2BeyOrder, nextI);

  const beyOpts = (player, selected) =>
    [0, 1, 2]
      .map((i) => {
        const lab = beyShortAt(player, i);
        const empty = lab === "—" || lab === "（未登記）";
        return `<option value="${i}" ${selected === i ? "selected" : ""} ${empty ? "" : ""}>${i + 1}：${escapeHtml(empty ? "未登記" : lab)}</option>`;
      })
      .join("");

  body.innerHTML = `
    <div class="battle-score-head">
      <div class="score-side ${totals.winnerId === p1.id ? "is-winner" : ""}">
        <div class="name">${escapeHtml(p1.name)}</div>
        <div class="p-bp">${totals.p1Bp}</div>
      </div>
      <div class="score-mid">BP</div>
      <div class="score-side ${totals.winnerId === p2.id ? "is-winner" : ""}">
        <div class="name">${escapeHtml(p2.name)}</div>
        <div class="p-bp">${totals.p2Bp}</div>
      </div>
    </div>
    <div class="winner-banner ${totals.done ? "ok" : ""}" id="winnerBanner">
      ${
        totals.draw
          ? `Match 完場 · 無分（${totals.p1Bp}:${totals.p2Bp}，兩邊唔計瑞士勝）`
          : totals.done
            ? `Match 完場 · 勝方：${escapeHtml(totals.winnerId === p1.id ? p1.name : p2.name)}（${totals.p1Bp}:${totals.p2Bp}）`
            : `累計 ${totals.p1Bp} : ${totals.p2Bp} · 先到 ${MATCH_TARGET} 分即勝`
      }
    </div>

    <div class="battle-log-list">
      ${battleRows || `<div class="empty-mini">尚未記錄 Battle — 下面新增第 1 場</div>`}
    </div>

    ${
      totals.done
        ? ""
        : `
    <div class="battle-add-panel">
      <h4>新增第 ${nextI + 1} 場 Battle</h4>
      <div class="battle-add-grid">
        <label>勝方
          <select id="battleWinner" class="input select">
            <option value="${p1.id}">${escapeHtml(p1.name)}</option>
            <option value="${p2.id}">${escapeHtml(p2.name)}</option>
            <option value="">平手（0分）</option>
          </select>
        </label>
        <label>Finish
          <select id="battleFinish" class="input select">
            <option value="extreme">Extreme Finish（3分）</option>
            <option value="over">Over Finish（2分）</option>
            <option value="burst">Burst Finish（2分）</option>
            <option value="spin" selected>Spin Finish（1分）</option>
            <option value="draw">平手（0分）</option>
          </select>
        </label>
        <label>${escapeHtml(p1.name)} 陀螺
          <select id="battleP1Bey" class="input select">
            <option value="">—</option>
            ${beyOpts(p1, def1)}
          </select>
        </label>
        <label>${escapeHtml(p2.name)} 陀螺
          <select id="battleP2Bey" class="input select">
            <option value="">—</option>
            ${beyOpts(p2, def2)}
          </select>
        </label>
      </div>
      <button type="button" class="btn btn-secondary" id="btnAddBattle" style="width:100%;margin-top:10px">＋ 加入此場 Battle</button>
    </div>`
    }

    <div class="btn-row wrap mt-16">
      <button type="button" class="btn btn-ghost" id="btnSaveBattlesPartial">暫存進度</button>
      <button type="button" class="btn btn-primary" id="btnSaveBattlesDone" style="margin-left:auto">
        ${totals.done ? "確認完場並關閉" : `儲存（需一方 ≥ ${MATCH_TARGET}）`}
      </button>
    </div>
  `;

  body.querySelectorAll(".battle-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      scoreBattleDraft.splice(Number(btn.dataset.i), 1);
      renderBattleScoreModal(p1, p2, m, opts);
    });
  });
  document.getElementById("btnAddBattle")?.addEventListener("click", () => {
    let winnerId = document.getElementById("battleWinner").value;
    let finishType = document.getElementById("battleFinish").value;
    if (!winnerId || finishType === "draw") {
      winnerId = null;
      finishType = "draw";
    }
    const p1b = document.getElementById("battleP1Bey").value;
    const p2b = document.getElementById("battleP2Bey").value;
    const points = finishPts(finishType);
    scoreBattleDraft.push({
      id: uid("b"),
      p1BeyIndex: p1b === "" ? null : Number(p1b),
      p2BeyIndex: p2b === "" ? null : Number(p2b),
      winnerId,
      finishType,
      points,
    });
    renderBattleScoreModal(p1, p2, m, opts);
  });
  document.getElementById("btnSaveBattlesPartial")?.addEventListener("click", async () => {
    if (opts.knockout) {
      await saveKoBattles(false);
    } else {
      if (await commitMatchBattles(scoreModalMatchId, scoreBattleDraft, false)) {
        closeScoreModal();
      }
    }
  });
  document.getElementById("btnSaveBattlesDone")?.addEventListener("click", async () => {
    if (opts.knockout) {
      await saveKoBattles(true);
    } else {
      const t2 = totalsFromBattles(p1.id, p2.id, scoreBattleDraft);
      if (!t2.done) {
        if (!confirm(`尚未有一方 ≥ ${MATCH_TARGET}（${t2.p1Bp}:${t2.p2Bp}）。仍強制完場？`)) return;
        if (await commitMatchBattles(scoreModalMatchId, scoreBattleDraft, true)) closeScoreModal();
      } else {
        if (await commitMatchBattles(scoreModalMatchId, scoreBattleDraft, false)) closeScoreModal();
      }
    }
  });
}

async function saveKoBattles(requireDone) {
  if (!koModalRef || !state.knockout) return;
  const m = getKoMatch(koModalRef);
  if (!m) return;
  const wasDone = !!m.done;
  const draft = normalizeBattles(scoreBattleDraft);
  const t = totalsFromBattles(m.p1, m.p2, draft);

  let willDone = !!t.done;
  let winnerId = t.winnerId;
  if (!willDone && requireDone) {
    if (t.p1Bp === 0 && t.p2Bp === 0) {
      toast("請至少記錄一場 Battle", "error");
      return;
    }
    if (!confirm(`尚未達 ${MATCH_TARGET} 分。強制完場？平手會記無分。`)) return;
    winnerId = await resolveForceWinner(m.p1, m.p2, t.p1Bp, t.p2Bp);
    willDone = true;
  }

  // 完場 → 未完：先 confirm 再改資料
  if (wasDone && !willDone && koMatchHasDownstream(koModalRef)) {
    if (!confirm("此場改為未完場會清除之後輪次／決賽結果。確定？")) return;
    let ri = koModalRef.type === "round" ? koModalRef.roundIndex : null;
    if (koModalRef.type === "semi") ri = (state.knockout.rounds?.length || 1) - 1;
    if (ri != null) invalidateKnockoutAfter(ri);
  }

  m.battles = draft;
  m.p1Bp = t.p1Bp;
  m.p2Bp = t.p2Bp;
  if (willDone) {
    if (!winnerId) {
      toast("淘汰賽必須分出勝方：繼續打到一方先到 4 分（唔可以無分晉級）", "error");
      return;
    }
    m.winner = winnerId;
    m.draw = false;
    m.done = true;
    saveKoResult(koModalRef, m.winner, m.p1Bp, m.p2Bp);
  } else {
    m.winner = null;
    m.draw = false;
    m.done = false;
    saveState();
    render();
    toast(`已暫存（${m.p1Bp}:${m.p2Bp}）`, "success");
  }
  closeScoreModal();
}

function buildScoreFormSimple(p1, p2, p1Bp, p2Bp) {
  return `
    <div class="score-note">先到 <strong>${MATCH_TARGET} 分</strong>即勝。平手記無分。</div>
    <div class="score-vs">
      <div class="score-side" id="scoreSide1" data-id="${p1.id}">
        <div class="name">${escapeHtml(p1.name)}</div>
        <input type="number" id="scoreP1" min="0" max="6" value="${p1Bp || 0}" inputmode="numeric" />
        <div class="quick">
          ${[0, 1, 2, 3, 4, 5, 6].map((n) => `<button type="button" data-target="scoreP1" data-val="${n}">${n}</button>`).join("")}
        </div>
        <div class="auto-win-tag" id="winTag1" hidden>勝方</div>
      </div>
      <div class="score-mid">BP</div>
      <div class="score-side" id="scoreSide2" data-id="${p2.id}">
        <div class="name">${escapeHtml(p2.name)}</div>
        <input type="number" id="scoreP2" min="0" max="6" value="${p2Bp || 0}" inputmode="numeric" />
        <div class="quick">
          ${[0, 1, 2, 3, 4, 5, 6].map((n) => `<button type="button" data-target="scoreP2" data-val="${n}">${n}</button>`).join("")}
        </div>
        <div class="auto-win-tag" id="winTag2" hidden>勝方</div>
      </div>
    </div>
    <div class="winner-banner" id="winnerBanner">—</div>
    <div class="score-note" id="scoreHint"></div>
    <button class="btn btn-primary" id="btnSaveScore" style="width:100%">儲存結果</button>
  `;
}

function bindScoreFormSimple(onSave) {
  const body = document.getElementById("scoreModalBody");
  body.querySelectorAll(".quick button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inp = document.getElementById(btn.dataset.target);
      inp.value = btn.dataset.val;
      updateScoreHintSimple();
    });
  });
  document.getElementById("scoreP1")?.addEventListener("input", updateScoreHintSimple);
  document.getElementById("scoreP2")?.addEventListener("input", updateScoreHintSimple);
  document.getElementById("btnSaveScore")?.addEventListener("click", onSave);
  updateScoreHintSimple();
}

function updateScoreHintSimple() {
  const hint = document.getElementById("scoreHint");
  const banner = document.getElementById("winnerBanner");
  const side1 = document.getElementById("scoreSide1");
  const side2 = document.getElementById("scoreSide2");
  const tag1 = document.getElementById("winTag1");
  const tag2 = document.getElementById("winTag2");
  if (!hint) return;
  const a = Math.max(0, parseInt(document.getElementById("scoreP1")?.value, 10) || 0);
  const b = Math.max(0, parseInt(document.getElementById("scoreP2")?.value, 10) || 0);
  const auto = autoWinnerFromScores(scoreModalP1Id, scoreModalP2Id, a, b);
  scoreModalWinner = auto;
  side1?.classList.toggle("is-winner", auto === scoreModalP1Id);
  side2?.classList.toggle("is-winner", auto === scoreModalP2Id);
  if (tag1) tag1.hidden = auto !== scoreModalP1Id;
  if (tag2) tag2.hidden = auto !== scoreModalP2Id;
  const p1 = playerById(scoreModalP1Id);
  const p2 = playerById(scoreModalP2Id);
  if (auto) {
    if (banner) {
      banner.textContent = `勝方：${auto === scoreModalP1Id ? p1?.name : p2?.name}（${a}:${b}）`;
      banner.className = "winner-banner ok";
    }
    hint.textContent = "可儲存結果。";
    hint.className = "score-note";
  } else if (a === b && a > 0) {
    if (banner) {
      banner.textContent = `平手 ${a}:${b} · 記無分（兩邊唔計瑞士勝）`;
      banner.className = "winner-banner";
    }
    hint.textContent = "官方先到 4 即勝；總分相同＝無分。";
    hint.className = "score-note";
  } else {
    if (banner) {
      banner.textContent = `目前 ${a} : ${b}`;
      banner.className = "winner-banner";
    }
    hint.textContent = `先到 ${MATCH_TARGET} 分勝出。`;
    hint.className = "score-note";
  }
}

function closeScoreModal() {
  document.getElementById("scoreModal").classList.add("hidden");
  scoreModalMatchId = null;
  scoreModalWinner = null;
  scoreModalP1Id = null;
  scoreModalP2Id = null;
  koModalRef = null;
  scoreBattleDraft = [];
}

// ─── Manual pairing modal ────────────────────────────────
function openManualModal() {
  const round = currentRoundObj();
  if (!round || round.locked) return;
  const body = document.getElementById("manualModalBody");
  const options = state.players
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}（${churchLabel(p.church)} · ${getPlayerStats(p.id).swissPoints}勝）</option>`)
    .join("");

  let rows = "";
  const pairCount = getMatchesPerRound();
  const odd = getPairingPlayerCount() % 2 === 1;
  for (let i = 0; i < pairCount; i++) {
    rows += `
      <div class="manual-pair-row">
        <select class="input select man-p1" data-i="${i}">${options}</select>
        <span style="font-weight:900;color:var(--muted)">VS</span>
        <select class="input select man-p2" data-i="${i}">${options}</select>
        <span class="match-num">桌 ${i + 1}</span>
      </div>`;
  }
  if (odd) {
    rows += `
      <div class="manual-pair-row">
        <select class="input select man-bye">${options}</select>
        <span style="font-weight:900;color:var(--muted)">→</span>
        <span class="meta" id="manByeHint">準時坐場＝自動勝 +1；遲到坐場＝0–4 負</span>
      </div>`;
  }
  body.innerHTML = `
    <div class="hint">每位選手只能出現一次。儲存後會覆蓋本輪配對。${odd ? "單數請指定坐場者：準時＝自動勝，遲到＝0–4 負。" : ""}</div>
    <div class="manual-list">${rows}</div>
    <div class="btn-row mt-16">
      <button class="btn btn-primary" id="btnSaveManual">儲存配對</button>
    </div>
  `;

  const duals = round.matches.filter((m) => !isByeMatch(m));
  body.querySelectorAll(".manual-pair-row").forEach((row, i) => {
    const m = duals[i];
    if (m && row.querySelector(".man-p1")) {
      row.querySelector(".man-p1").value = m.p1;
      row.querySelector(".man-p2").value = m.p2;
    }
  });
  const byeMatch = round.matches.find((m) => isByeMatch(m));
  const syncManByeHint = () => {
    const hint = body.querySelector("#manByeHint");
    const sel = body.querySelector(".man-bye");
    if (!hint || !sel) return;
    const pl = playerById(sel.value);
    hint.textContent = isLatePlayer(pl)
      ? "遲到坐場＝0–4 負（唔計勝）"
      : "準時坐場＝自動獲勝 +1";
  };
  if (odd && byeMatch) {
    const sel = body.querySelector(".man-bye");
    if (sel) sel.value = byeMatch.p1;
  }
  body.querySelector(".man-bye")?.addEventListener("change", syncManByeHint);
  syncManByeHint();

  document.getElementById("btnSaveManual").addEventListener("click", () => {
    const pairs = [];
    body.querySelectorAll(".man-p1").forEach((sel) => {
      const row = sel.closest(".manual-pair-row");
      pairs.push([sel.value, row.querySelector(".man-p2").value]);
    });
    if (odd) {
      const byeId = body.querySelector(".man-bye")?.value;
      if (byeId) pairs.push([byeId, null]);
    }
    if (pairs.some(([a, b]) => b && a === b)) {
      toast("同一場不能選同一人", "error");
      return;
    }
    applyManualPairings(pairs);
  });

  document.getElementById("manualModal").classList.remove("hidden");
}

function closeManualModal() {
  document.getElementById("manualModal").classList.add("hidden");
}

// ─── Tabs ────────────────────────────────────────────────
const TAB_STORAGE_KEY = "baoluo-cup-next-active-tab";
const VALID_TABS = ["settings", "rules", "players", "pairings", "standings", "history", "ties", "knockout", "draw", "export"];

function getSavedTab() {
  try {
    const t = localStorage.getItem(TAB_STORAGE_KEY);
    if (t && VALID_TABS.includes(t)) return t;
  } catch (_) {}
  return "settings";
}

/** 優先用 URL hash（refresh 會保留），其次 localStorage */
function getInitialTab() {
  try {
    const hash = (location.hash || "").replace(/^#/, "").trim();
    if (VALID_TABS.includes(hash)) return hash;
  } catch (_) {}
  return getSavedTab();
}

function switchTab(name, opts = {}) {
  if (!VALID_TABS.includes(name)) name = "settings";
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.id === "tab-" + name);
  });
  try {
    localStorage.setItem(TAB_STORAGE_KEY, name);
  } catch (_) {}
  // URL hash：refresh 時瀏覽器會保留 #pairings
  if (!opts.fromHash) {
    try {
      const next = "#" + name;
      if (location.hash !== next) {
        history.replaceState(null, "", next);
      }
    } catch (_) {}
  }
  updateProjectionBodyClass();
  if (name === "pairings") renderPairings();
  if (name === "standings") renderStandings();
  if (name === "history") renderHistory();
  if (name === "rules") renderRules();
  if (name === "draw") renderDraw();
}

// ─── Init ────────────────────────────────────────────────
function updateSyncUi() {
  const sync = window.BaoluoSync;
  const st = sync?.getStatus?.() || {
    configured: false,
    roomId: null,
    role: null,
    connected: false,
    isHost: false,
    isReadOnly: false,
    pendingPush: false,
  };

  const pill = document.getElementById("syncPill");
  const banner = document.getElementById("syncBanner");
  const bannerText = document.getElementById("syncBannerText");
  const statusBox = document.getElementById("cloudSyncStatus");
  const footer = document.getElementById("footerStorageHint");
  const btnShow = document.getElementById("btnCloudShowId");
  const btnLeave = document.getElementById("btnCloudLeave");
  const btnCreate = document.getElementById("btnCloudCreate");
  const btnJoin = document.getElementById("btnCloudJoin");

  document.body.classList.toggle("sync-readonly", !!st.isReadOnly);

  if (pill) {
    pill.classList.remove("host", "viewer", "offline");
    if (!st.configured) {
      pill.textContent = "本機";
      pill.title = "未設定 Firebase · 純本機模式";
    } else if (!st.roomId) {
      pill.textContent = "本機";
      pill.title = "未加入雲端比賽";
    } else if (!st.connected) {
      pill.textContent = `${st.roomId} · 離線`;
      pill.classList.add("offline");
      pill.title = "雲端連線中斷，主持改動會暫存本機";
    } else if (st.isHost) {
      pill.textContent = `${st.roomId} · 主持${st.pendingPush ? "…" : ""}`;
      pill.classList.add("host");
      pill.title = "主持模式 · 可改分並同步";
    } else {
      pill.textContent = `${st.roomId} · 只讀`;
      pill.classList.add("viewer");
      pill.title = "只讀 · 即時同步中";
    }
  }

  if (banner && bannerText) {
    if (st.roomId) {
      banner.classList.remove("hidden");
      banner.classList.toggle("host", !!st.isHost);
      bannerText.textContent = st.isHost
        ? getDeviceRole() === "score"
          ? `☁ ${st.roomId} · 計分板（入分會即時上主電腦）`
          : `☁ 比賽 ${st.roomId} · 大會主電腦（投影／選手／賽果）`
        : `☁ 比賽 ${st.roomId} · 只讀（即時同步）`;
    } else {
      banner.classList.add("hidden");
    }
  }

  if (statusBox) {
    if (!st.configured) {
      statusBox.textContent =
        "未設定 Firebase。請複製 firebase-config.example.js → firebase-config.js 並填入專案設定（見 README）。而家仍可本機單機用。";
    } else if (!st.roomId) {
      statusBox.textContent = "Firebase 已就緒 · 尚未加入比賽（本機模式）";
    } else {
      statusBox.textContent = [
        `比賽 ID：${st.roomId}`,
        st.isHost
          ? getDeviceRole() === "score"
            ? "角色：計分板（可寫）"
            : "角色：大會主電腦（可寫）"
          : "角色：只讀",
        st.connected ? "狀態：已連線" : "狀態：離線／重連中",
        st.pendingPush ? "有變更等待上傳…" : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const inRoom = !!st.roomId;
  if (btnShow) btnShow.disabled = !inRoom;
  if (btnLeave) btnLeave.disabled = !inRoom;
  if (btnCreate) btnCreate.disabled = !!st.isReadOnly;
  if (btnJoin) btnJoin.disabled = false;

  if (footer) {
    footer.textContent = inRoom
      ? st.isHost
        ? `雲端主持 · 比賽 ${st.roomId}（同時存本機）`
        : `雲端只讀 · 比賽 ${st.roomId}`
      : "資料自動儲存於本機瀏覽器（localStorage）";
  }
}

function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}
function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function showCloudIdModal() {
  const id = window.BaoluoSync?.getRoomId?.();
  if (!id) {
    toast("尚未加入雲端比賽", "error");
    return;
  }
  const big = document.getElementById("cloudIdBig");
  if (big) big.textContent = id;
  openModal("cloudIdModal");
}

async function handleCloudCreate() {
  if (!assertCanWrite()) return;
  const sync = window.BaoluoSync;
  if (!sync?.isConfigReady?.()) {
    toast("請先設定 firebase-config.js", "error");
    return;
  }
  const p1 = document.getElementById("cloudCreatePass")?.value || "";
  const p2 = document.getElementById("cloudCreatePass2")?.value || "";
  if (p1.length < 4) {
    toast("主持碼至少 4 位", "error");
    return;
  }
  if (p1 !== p2) {
    toast("兩次主持碼唔一致", "error");
    return;
  }
  if (
    !isFreshTournamentState(state) &&
    !confirm("而家本機仲有比賽資料。建立新雲端會把呢份資料帶去新場。\n若要開全新一場，請先撳「重置全部資料」。繼續？")
  ) {
    return;
  }
  try {
    if (sync.getRoomId?.()) {
      if (!confirm("而家已連住另一場雲端比賽。建立新場會先離開舊場，繼續？")) return;
      if (!isFreshTournamentState(state)) await sync.flush?.(state);
      sync.leaveRoom();
    }
    if (!state.instanceId) state.instanceId = newTournamentInstanceId();
    saveState();
    setDeviceRole("desk");
    const { roomId } = await sync.createRoom(p1, state);
    const result = document.getElementById("cloudCreateResult");
    if (result) {
      result.classList.remove("hidden");
      result.innerHTML = `
        <p>已建立！請抄低／分享：</p>
        <div class="sync-id-big">${roomId}</div>
        <p class="hint">手機／iPad：加入比賽 → 揀「計分板」→ 填 ID 同主持碼。只睇投影：只填 ID。</p>
        <div class="btn-row wrap" style="justify-content:center">
          <button type="button" class="btn btn-primary" id="btnCloudCreateCopy">複製比賽 ID</button>
        </div>`;
      document.getElementById("btnCloudCreateCopy")?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(roomId);
          toast("已複製比賽 ID", "success");
        } catch {
          toast("請手動複製：" + roomId, "error");
        }
      });
    }
    updateSyncUi();
    toast("雲端比賽已建立：" + roomId, "success");
  } catch (e) {
    console.error(e);
    toast(e.message || String(e), "error");
  }
}

async function joinCloudRoom(joinRole, roomId, pass) {
  const sync = window.BaoluoSync;
  if (!sync?.isConfigReady?.()) {
    toast("請先設定 firebase-config.js", "error");
    return false;
  }
  if (joinRole !== "view" && !String(pass || "").trim()) {
    toast("計分板同大會主電腦都要填主持碼", "error");
    return false;
  }
  if (joinRole === "view") pass = "";
  if (sync.getRoomId?.()) {
    if (!isFreshTournamentState(state)) await sync.flush?.(state);
    sync.leaveRoom();
  }
  const joined = await sync.joinRoom(roomId, pass);
  if (joined.state) {
    if (
      state.players.length > 0 &&
      !confirm("加入雲端會用遠端資料覆蓋本機畫面。本機而家有資料，確定繼續？")
    ) {
      sync.leaveRoom();
      updateSyncUi();
      return false;
    }
    applyRemoteTournamentState(
      {
        rev: joined.rev,
        state: joined.state,
        updatedAt: null,
      },
      { force: true }
    );
  }
  const role = joined.role === "host" ? joinRole : "view";
  setDeviceRole(role);
  updateSyncUi();
  return { joined, role };
}

function openPadJoinModal() {
  const idEl = document.getElementById("padJoinId");
  const passEl = document.getElementById("padJoinPass");
  if (idEl) idEl.value = window.BaoluoSync?.getRoomId?.() || "";
  if (passEl) passEl.value = "";
  openModal("padJoinModal");
  setTimeout(() => (idEl?.value ? passEl : idEl)?.focus?.(), 50);
}

async function handlePadCloudJoin() {
  const roomId = document.getElementById("padJoinId")?.value || "";
  const pass = document.getElementById("padJoinPass")?.value || "";
  if (!String(roomId).trim()) {
    toast("請輸入比賽 ID", "error");
    return;
  }
  if (!String(pass).trim()) {
    toast("計分板要填主持碼先可以入分", "error");
    return;
  }
  try {
    const out = await joinCloudRoom("score", roomId, pass);
    if (!out) return;
    closeModal("padJoinModal");
    setDeviceRole("score");
    openScorePad();
    toast(
      out.role === "score"
        ? `已連線 ${out.joined.roomId} · 計分板`
        : `主持碼不正確，而家係只讀。請再試。`,
      out.role === "score" ? "success" : "error"
    );
  } catch (e) {
    console.error(e);
    toast(e.message || String(e), "error");
  }
}

async function handleCloudJoin() {
  const roomId = document.getElementById("cloudJoinId")?.value || "";
  const joinRole = document.querySelector('input[name="joinRole"]:checked')?.value || "score";
  const pass = document.getElementById("cloudJoinPass")?.value || "";
  try {
    const out = await joinCloudRoom(joinRole, roomId, pass);
    if (!out) return;
    closeModal("cloudJoinModal");
    if (out.role === "score") {
      openScorePad();
      toast(`已連線 ${out.joined.roomId} · 計分板`, "success");
    } else {
      toast(
        out.joined.role === "host" ? `已以大會主電腦加入 ${out.joined.roomId}` : `已只讀加入 ${out.joined.roomId}`,
        "success"
      );
    }
  } catch (e) {
    console.error(e);
    toast(e.message || String(e), "error");
  }
}

async function handleCloudLeave() {
  if (!confirm("離開雲端比賽？本機資料會保留，但唔再即時同步。")) return;
  await window.BaoluoSync?.flush?.(state);
  window.BaoluoSync?.leaveRoom?.();
  updateSyncUi();
  toast("已離開雲端", "success");
}

function bindCloudSyncUi() {
  const sync = window.BaoluoSync;
  if (!sync) return;

  document.getElementById("btnCloudCreate")?.addEventListener("click", () => {
    if (!sync.isConfigReady()) {
      toast("請先設定 firebase-config.js（見 README）", "error");
      return;
    }
    document.getElementById("cloudCreatePass").value = "";
    document.getElementById("cloudCreatePass2").value = "";
    document.getElementById("cloudCreateResult")?.classList.add("hidden");
    openModal("cloudCreateModal");
  });
  document.getElementById("btnCloudJoin")?.addEventListener("click", () => {
    if (!sync.isConfigReady()) {
      toast("請先設定 firebase-config.js（見 README）", "error");
      return;
    }
    document.getElementById("cloudJoinId").value = "";
    document.getElementById("cloudJoinPass").value = "";
    openModal("cloudJoinModal");
  });
  document.getElementById("btnCloudShowId")?.addEventListener("click", showCloudIdModal);
  document.getElementById("btnSyncShowId")?.addEventListener("click", showCloudIdModal);
  document.getElementById("btnCloudLeave")?.addEventListener("click", handleCloudLeave);
  document.getElementById("btnSyncLeave")?.addEventListener("click", handleCloudLeave);

  document.getElementById("btnCloseCloudCreate")?.addEventListener("click", () => closeModal("cloudCreateModal"));
  document.getElementById("btnCloseCloudJoin")?.addEventListener("click", () => closeModal("cloudJoinModal"));
  document.getElementById("btnCloseCloudId")?.addEventListener("click", () => closeModal("cloudIdModal"));
  document.getElementById("btnCloudCreateConfirm")?.addEventListener("click", () => handleCloudCreate());
  document.getElementById("btnCloudJoinConfirm")?.addEventListener("click", () => handleCloudJoin());
  document.getElementById("btnPadJoinConfirm")?.addEventListener("click", () => handlePadCloudJoin());
  document.getElementById("btnClosePadJoin")?.addEventListener("click", () => closeModal("padJoinModal"));
  document.getElementById("padJoinModal")?.addEventListener("click", (e) => {
    if (e.target.id === "padJoinModal") closeModal("padJoinModal");
  });
  document.getElementById("padJoinPass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handlePadCloudJoin();
  });
  document.getElementById("padJoinId")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("padJoinPass")?.focus();
  });
  const syncJoinRoles = () => {
    document.querySelectorAll(".join-role").forEach((lab) => {
      lab.classList.toggle("on", !!lab.querySelector("input")?.checked);
    });
  };
  document.getElementById("joinRoleGroup")?.addEventListener("change", syncJoinRoles);
  syncJoinRoles();
  document.getElementById("btnCloudCopyId")?.addEventListener("click", async () => {
    const id = sync.getRoomId();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      toast("已複製比賽 ID", "success");
    } catch {
      toast("請手動複製：" + id, "error");
    }
  });

  sync.onStatus(() => updateSyncUi());
  sync.onRemote((payload) => applyRemoteTournamentState(payload));

  // 恢復上次 session
  sync.resumeSession?.().then(async (resumed) => {
    if (!resumed) {
      updateSyncUi();
      return;
    }
    const localRev = parseInt(state._rev, 10) || 0;
    const remoteRev = parseInt(resumed.rev, 10) || 0;
    if (resumed.role === "host" && localRev > remoteRev) {
      await sync.flush?.(state);
    } else if (resumed.state) {
      applyRemoteTournamentState({
        rev: resumed.rev,
        state: resumed.state,
        updatedAt: null,
      });
    }
    updateSyncUi();
    if (getDeviceRole() === "score") openScorePad();
    toast(
      resumed.role === "host"
        ? getDeviceRole() === "score"
          ? `已恢復計分板 ${resumed.roomId}`
          : `已恢復主持連線 ${resumed.roomId}`
        : `已恢復只讀連線 ${resumed.roomId}`,
      "success"
    );
  });

  const flushCloud = () => {
    if (sync.isHost?.()) sync.flush?.(state);
  };
  window.addEventListener("pagehide", flushCloud);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCloud();
  });

  updateSyncUi();
}

function init() {
  // Nav
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  // 瀏覽器前後按鈕 / 手動改 hash
  window.addEventListener("hashchange", () => {
    const hash = (location.hash || "").replace(/^#/, "").trim();
    if (VALID_TABS.includes(hash)) switchTab(hash, { fromHash: true });
  });
  bindRulesCollapse();
  bindDrawUi();
  // 還原分頁：URL #pairings 優先，其次 localStorage（refresh 會留喺同一分頁）
  switchTab(getInitialTab());

  bindCloudSyncUi();


  // 新增選手：教會二選一（radio，原生互斥）
  const newChurchRoot = document.getElementById("newChurchChecks");
  if (newChurchRoot) {
    syncChurchCheckStyles(newChurchRoot);
    newChurchRoot.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener("change", () => syncChurchCheckStyles(newChurchRoot));
    });
    // 點整塊 label 時同步樣式（雙重保險）
    newChurchRoot.querySelectorAll(".church-check").forEach((lab) => {
      lab.addEventListener("click", () => {
        // 讓瀏覽器先處理 radio，再於下一幀同步樣式
        requestAnimationFrame(() => syncChurchCheckStyles(newChurchRoot));
      });
    });
  }

  document.getElementById("btnAddPlayer").addEventListener("click", () => {
    const name = document.getElementById("newName").value;
    const church = getSelectedChurch("#newChurchChecks");
    if (!church) {
      toast("請選擇所屬教會", "error");
      return;
    }
    if (addPlayer(name, church)) {
      document.getElementById("newName").value = "";
      document.getElementById("newName").focus();
    }
  });
  document.getElementById("newName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnAddPlayer").click();
  });

  document.getElementById("btnFillDemo").addEventListener("click", fillDemo);
  document.getElementById("btnClearPlayers").addEventListener("click", () => {
    if (state.phase !== "setup") return;
    if (confirm("清空全部選手？")) {
      state.players = [];
      saveState();
      render();
    }
  });
  // 選手列表篩選：教會／陀螺完成狀態
  document.getElementById("playerFilterBar")?.addEventListener("click", (e) => {
    const churchBtn = e.target.closest("[data-filter-church]");
    if (churchBtn) {
      playerFilterChurch = churchBtn.dataset.filterChurch || "all";
      renderPlayers();
      return;
    }
    const deckBtn = e.target.closest("[data-filter-deck]");
    if (deckBtn) {
      playerFilterDeck = deckBtn.dataset.filterDeck || "all";
      renderPlayers();
    }
  });
  // 對戰表模式切換（固定工具列，不隨 matchGrid 重繪）
  const sticky = document.getElementById("pairStickyBar");
  if (sticky) {
    sticky.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pair-view]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      setPairingsViewMode(btn.dataset.pairView);
    });
  }
  // 排名頁投影／詳細切換
  document.getElementById("standingsStickyBar")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-standings-view]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    setStandingsViewMode(btn.dataset.standingsView);
  });
  // 同步按鈕樣式（唔強制 re-render 整頁，避免初始化死循環）
  document.querySelectorAll(".pair-mode-btn").forEach((b) => {
    const on = b.dataset.pairView === pairingsViewMode;
    b.classList.toggle("active", on);
    b.classList.toggle("btn-secondary", on);
    b.classList.toggle("btn-ghost", !on);
  });
  document.querySelectorAll(".staff-tools").forEach((el) => {
    el.style.display = pairingsViewMode === "staff" ? "" : "none";
  });
  document.querySelectorAll(".standings-mode-btn").forEach((b) => {
    const on = b.dataset.standingsView === standingsViewMode;
    b.classList.toggle("active", on);
    b.classList.toggle("btn-secondary", on);
    b.classList.toggle("btn-ghost", !on);
  });

  document.getElementById("btnSaveSettings")?.addEventListener("click", saveSettingsFromForm);
  const previewSettings = () => {
    // 即時預覽：重用 renderSettings 邏輯（讀表單值寫入臨時 state 會污染，故只更新 calc／preview）
    const referees = parseInt(document.getElementById("setReferees")?.value, 10);
    const stadiums = parseInt(document.getElementById("setStadiums")?.value, 10);
    const swissRounds = parseInt(document.getElementById("setSwissRounds")?.value, 10);
    const playerPreset = document.getElementById("setPlayerPreset")?.value || "16";
    const koSize = parseInt(document.getElementById("setKoSize")?.value, 10);
    const qualifyRule = document.getElementById("setQualifyRule")?.value || "A";
    const playerCount =
      playerPreset === "other"
        ? parseInt(document.getElementById("setPlayerCountCustom")?.value, 10)
        : parseInt(playerPreset, 10);
    const tmp = normalizeSettings({
      referees,
      stadiums,
      swissRounds,
      playerCount,
      playerPreset,
      koSize,
      qualifyRule,
    });
    const stations = Math.max(1, Math.min(tmp.referees, tmp.stadiums));
    fillSettingsCalculator(tmp.playerCount, tmp.swissRounds, tmp.koSize);
    const preview = document.getElementById("settingsPreview");
    if (preview) {
      const zones = Array.from({ length: stations }, (_, i) => zoneLabel(i)).join("、");
      preview.innerHTML = `
          <div class="hint" style="margin:0">
            <strong>預覽 · ${tmp.playerCount} 人</strong>（每輪 ${Math.floor(tmp.playerCount / 2)} 場${tmp.playerCount % 2 ? "＋1 輪空" : ""}）
            · 站 ${stations} · 瑞士 ${tmp.swissRounds} 輪 · 淘汰 ${tmp.koSize} 強 · 入圍 ${qualifyRuleLabel(tmp.qualifyRule)}<br>
            分派：<strong>${zones}</strong>
            <br><span class="meta">按「儲存設定」後生效</span>
          </div>`;
    }
    const koEl = document.getElementById("setKoSize");
    if (koEl) {
      [...koEl.options].forEach((opt) => {
        const v = parseInt(opt.value, 10);
        opt.disabled = v > tmp.playerCount;
        opt.hidden = v > tmp.playerCount;
      });
    }
    updateQualifyRuleHint(tmp.qualifyRule);
    syncPlayerCountCustomVisibility();
  };
  ["setReferees", "setStadiums", "setSwissRounds", "setPlayerPreset", "setPlayerCountCustom", "setKoSize", "setQualifyRule"].forEach(
    (id) => {
      document.getElementById(id)?.addEventListener("change", previewSettings);
      document.getElementById(id)?.addEventListener("input", previewSettings);
    }
  );

  document.getElementById("btnStartTournament").addEventListener("click", startTournament);
  document.getElementById("btnCloseDeck").addEventListener("click", closeDeckModal);
  document.getElementById("deckModal").addEventListener("click", (e) => {
    if (e.target.id === "deckModal") closeDeckModal();
  });
  document.getElementById("btnRegenPairing").addEventListener("click", regeneratePairing);
  document.getElementById("btnLockRound").addEventListener("click", lockRoundAndAdvance);
  document.getElementById("btnManualPair").addEventListener("click", openManualModal);
  document.getElementById("btnPairOpenPad")?.addEventListener("click", openScorePad);
  document.getElementById("btnOpenScorePad")?.addEventListener("click", openScorePad);
  document.getElementById("scorePad")?.addEventListener("click", onScorePadClick);
  document.getElementById("padVideoCapture")?.addEventListener("change", (e) => {
    padOnVideoCaptured(e);
  });
  document.getElementById("btnCloseScore").addEventListener("click", closeScoreModal);
  document.getElementById("btnCloseManual").addEventListener("click", closeManualModal);
  document.getElementById("btnCloseBeyOrder")?.addEventListener("click", closeBeyOrderModal);
  document.getElementById("scoreModal").addEventListener("click", (e) => {
    if (e.target.id === "scoreModal") closeScoreModal();
  });
  document.getElementById("manualModal").addEventListener("click", (e) => {
    if (e.target.id === "manualModal") closeManualModal();
  });
  document.getElementById("beyOrderModal")?.addEventListener("click", (e) => {
    if (e.target.id === "beyOrderModal") closeBeyOrderModal();
  });

  document.getElementById("btnStartKnockout").addEventListener("click", startKnockout);
  document.getElementById("btnRedoKnockout")?.addEventListener("click", redoKnockout);
  document.getElementById("btnCloseTieWinner")?.addEventListener("click", () => {
    toast("已取消：必須指定勝方", "error");
    closeTieWinnerModal();
  });
  document.getElementById("tieWinnerModal")?.addEventListener("click", (e) => {
    if (e.target.id === "tieWinnerModal") {
      toast("已取消：必須指定勝方", "error");
      closeTieWinnerModal();
    }
  });

  document.getElementById("btnExportStandings").addEventListener("click", exportStandingsCsv);
  document.getElementById("btnExportMatches").addEventListener("click", exportMatchesCsv);
  document.getElementById("btnExportText").addEventListener("click", exportTextReport);
  document.getElementById("btnExportJson")?.addEventListener("click", () => exportJson({ hideBeyOrder: false }));
  document.getElementById("btnExportJsonSafe")?.addEventListener("click", () => exportJson({ hideBeyOrder: true }));
  document.getElementById("btnManualBackup")?.addEventListener("click", () => {
    pushAutoBackup("手動備份");
    toast("已建立本機備份", "success");
    renderBackupPanel();
  });
  document.getElementById("btnImportJson").addEventListener("click", () => {
    document.getElementById("jsonFileInput").click();
  });
  document.getElementById("jsonFileInput").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importJsonFile(f);
    e.target.value = "";
  });
  document.getElementById("btnResetAll").addEventListener("click", resetAll);

  // 多 tab／多視窗：提示重新載入（無真正多機同步）
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === STORAGE_KEY + "-rev") {
      const msg =
        "偵測到另一分頁／裝置分頁更新了資料！\n\n按「確定」重新載入本頁以取得最新資料（未儲存於本頁嘅改動會丟失）。\n按「取消」繼續用本頁（之後儲存可能覆蓋對方）。";
      if (confirm(msg)) {
        location.reload();
      } else {
        toast("請盡快重新整理，避免互相覆蓋", "error");
      }
    }
  });

  render();
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("pad") === "1" || q.get("mode") === "score" || getDeviceRole() === "score") {
      openScorePad();
    }
  } catch (_) {}
}

init();
