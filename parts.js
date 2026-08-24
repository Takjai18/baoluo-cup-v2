/**
 * 寶螺盃 · Beyblade X 零件清單
 * 上蓋：完整名 + 編號 + 系列（BX / UX / CX / BXG / COLLAB）
 * 固鎖 / 軸心：完整官方代碼
 */

const PARTS = {
  /**
   * code: 產品編號
   * name: 中文名
   * en: 英文名
   * series: BX | UX | CX | BXG | COLLAB | OTHER
   * tier: T0 | T1 | ""  （本活動特別限制）
   */
  blades: [
    // ── BX ──
    { id: "bx-01", code: "BX-01", name: "蒼龍神劍", en: "DranSword", series: "BX", tier: "" },
    {
      id: "bx-00-dransword-v2",
      code: "BX-00",
      name: "蒼龍神劍 V2",
      en: "DranSwordV2",
      series: "BX",
      tier: "",
      staffCode: "BX00-V2",
    },
    { id: "bx-02", code: "BX-02", name: "惡魔紅鐮", en: "HellsScythe", series: "BX", tier: "" },
    { id: "bx-03", code: "BX-03", name: "魔導幻箭", en: "WizardArrow", series: "BX", tier: "" },
    { id: "bx-04", code: "BX-04", name: "騎士重盾", en: "KnightShield", series: "BX", tier: "" },
    { id: "bx-13", code: "BX-13", name: "騎士長槍", en: "KnightLance", series: "BX", tier: "" },
    { id: "bx-14", code: "BX-14", name: "鮫鯊鋒鰭", en: "SharkEdge", series: "BX", tier: "" },
    { id: "bx-15", code: "BX-15", name: "雄獅獵爪", en: "LeonClaw", series: "BX", tier: "" },
    { id: "bx-16", code: "BX-16", name: "王蛇鞭尾", en: "ViperTail", series: "BX", tier: "" },
    { id: "bx-19", code: "BX-19", name: "戰犀號角", en: "RhinoHorn", series: "BX", tier: "" },
    { id: "bx-20", code: "BX-20", name: "蒼龍利刃", en: "DranDagger", series: "BX", tier: "" },
    { id: "bx-21", code: "BX-21", name: "惡魔鎖鏈", en: "HellsChain", series: "BX", tier: "" },
    { id: "bx-23", code: "BX-23", name: "鳳凰飛翼", en: "PhoenixWing", series: "BX", tier: "T1" },
    { id: "bx-24", code: "BX-24", name: "飛龍旋翼", en: "WyvernGale", series: "BX", tier: "" },
    { id: "bx-26", code: "BX-26", name: "獨角刺心", en: "UnicornSting", series: "BX", tier: "" },
    { id: "bx-27", code: "BX-27", name: "幻神護甲", en: "SphinxCowl", series: "BX", tier: "" },
    { id: "bx-31", code: "BX-31", name: "暴龍霸擊", en: "TyrannoBeat", series: "BX", tier: "" },
    { id: "bx-33", code: "BX-33", name: "皓戰猛虎", en: "WeissTiger", series: "BX", tier: "" },
    { id: "bx-34", code: "BX-34", name: "蒼穹龍騎士", en: "CobaltDragoon", series: "BX", tier: "T1" },
    { id: "bx-36", code: "BX-36", name: "巨鯨怒濤", en: "WhaleWave", series: "BX", tier: "" },
    { id: "bx-38", code: "BX-38", name: "赫燃天鳳", en: "CrimsonGaruda", series: "BX", tier: "" },
    { id: "bx-44", code: "BX-44", name: "三角強襲", en: "TriceraPress", series: "BX", tier: "" },
    { id: "bx-45", code: "BX-45", name: "武士魂斬", en: "SamuraiCalibur", series: "BX", tier: "" },
    { id: "bx-49", code: "BX-49", name: "蒼龍突擊", en: "DranStrike", series: "BX", tier: "T1" },
    { id: "bx-50", code: "BX-50", name: "天界之環", en: "Heaven's Ring", series: "BX", tier: "" },

    // ── BXG（X-Over／復刻；產品碼常標 BX-00／BXG-xx）──
    { id: "bxg-01", code: "BXG-01", name: "升龍螺旋", en: "DranzerSpiral", series: "BXG", tier: "", staffCode: "BXG01" },
    { id: "bxg-04", code: "BXG-04", name: "白虎裂斬", en: "DrigerSlash", series: "BXG", tier: "", staffCode: "BXG04" },
    { id: "bxg-07", code: "BXG-07", name: "閃電天龍", en: "LightningLDrago", series: "BXG", tier: "", staffCode: "BXG07" },
    { id: "bxg-11", code: "BXG-11", name: "聖盾龜甲", en: "DracielShield", series: "BXG", tier: "", staffCode: "BXG11" },
    { id: "bxg-13", code: "BXG-13", name: "異域聖劍", en: "XenoXcalibur", series: "BXG", tier: "", staffCode: "BXG13" },
    { id: "bxg-20", code: "BXG-20", name: "岩石雄獅", en: "RockLeone", series: "BXG", tier: "", staffCode: "BXG20" },
    { id: "bxg-21", code: "BXG-21", name: "風暴精靈", en: "StormSpriggan", series: "BXG", tier: "", staffCode: "BXG21" },
    { id: "bxg-22", code: "BXG-22", name: "蒼龍風暴", en: "DragoonStorm", series: "BXG", tier: "", staffCode: "BXG22" },
    { id: "bxg-pegasis", code: "BXG-47", name: "風暴飛馬", en: "StormPegasis", series: "BXG", tier: "", staffCode: "BXG47" },
    { id: "bxg-valkyrie", code: "BXG-00", name: "勝利女武神", en: "VictoryValkyrie", series: "BXG", tier: "", staffCode: "BXG-戰神" },

    // ── IP 聯名（Marvel／Star Wars／Transformers／Jurassic；產品碼 BXG-xx）──
    { id: "collab-ironman", code: "BXG-29", name: "鋼鐵俠", en: "IronMan", series: "COLLAB", tier: "", staffCode: "聯名-鋼鐵俠" },
    { id: "collab-thanos", code: "BXG-29", name: "滅霸", en: "Thanos", series: "COLLAB", tier: "", staffCode: "聯名-滅霸" },
    { id: "collab-spiderman", code: "BXG-30", name: "蜘蛛俠", en: "SpiderMan", series: "COLLAB", tier: "", staffCode: "聯名-蜘蛛俠" },
    { id: "collab-venom", code: "BXG-30", name: "毒液", en: "Venom", series: "COLLAB", tier: "", staffCode: "聯名-毒液" },
    { id: "collab-luke", code: "BXG-33", name: "天行者盧克", en: "LukeSkywalker", series: "COLLAB", tier: "", staffCode: "聯名-盧克" },
    { id: "collab-vader", code: "BXG-33", name: "黑武士", en: "DarthVader", series: "COLLAB", tier: "", staffCode: "聯名-黑武士" },
    { id: "collab-mandalorian", code: "BXG-34", name: "曼達洛人", en: "Mandalorian", series: "COLLAB", tier: "", staffCode: "聯名-曼達洛" },
    { id: "collab-gideon", code: "BXG-34", name: "吉迪恩總督", en: "MoffGideon", series: "COLLAB", tier: "", staffCode: "聯名-吉迪恩" },
    { id: "collab-optimus", code: "BXG-36", name: "柯博文", en: "OptimusPrime", series: "COLLAB", tier: "", staffCode: "聯名-柯博文" },
    { id: "collab-megatron", code: "BXG-36", name: "威震天", en: "Megatron", series: "COLLAB", tier: "", staffCode: "聯名-威震天" },
    { id: "collab-primal", code: "BXG-37", name: "至尊金剛", en: "OptimusPrimal", series: "COLLAB", tier: "", staffCode: "聯名-至尊金剛" },
    { id: "collab-starscream", code: "BXG-37", name: "紅蜘蛛", en: "Starscream", series: "COLLAB", tier: "", staffCode: "聯名-紅蜘蛛" },
    { id: "collab-spinosaurus", code: "BXG-41", name: "棘龍", en: "Spinosaurus", series: "COLLAB", tier: "", staffCode: "聯名-棘龍" },
    { id: "collab-quetzalcoatlus", code: "BXG-41", name: "風神翼龍", en: "Quetzalcoatlus", series: "COLLAB", tier: "", staffCode: "聯名-風神翼龍" },
    // Hasbro 變形金剛追加（常見改裝上蓋，現場登記用）
    { id: "collab-bumblebee", code: "BX-00", name: "大黃蜂", en: "Bumblebee", series: "COLLAB", tier: "", staffCode: "聯名-大黃蜂" },
    { id: "collab-shockwave", code: "BX-00", name: "震波", en: "Shockwave", series: "COLLAB", tier: "", staffCode: "聯名-震波" },

    // ── UX ──
    { id: "ux-01", code: "UX-01", name: "蒼龍爆刃", en: "DranBuster", series: "UX", tier: "" },
    { id: "ux-02", code: "UX-02", name: "惡魔戰鎚", en: "HellsHammer", series: "UX", tier: "" },
    { id: "ux-03", code: "UX-03", name: "魔導神杖", en: "WizardRod", series: "UX", tier: "T0" },
    { id: "ux-05", code: "UX-05", name: "忍者闇影", en: "ShinobiShadow", series: "UX", tier: "" },
    { id: "ux-06", code: "UX-06", name: "雄獅紋章", en: "LeonCrest", series: "UX", tier: "" },
    { id: "ux-07", code: "UX-07", name: "鳳凰尾翼", en: "PhoenixRudder", series: "UX", tier: "T1" },
    { id: "ux-08", code: "UX-08", name: "霜輝銀狼", en: "SilverWolf", series: "UX", tier: "" },
    { id: "ux-09", code: "UX-09", name: "武士星劍", en: "SamuraiSaber", series: "UX", tier: "" },
    { id: "ux-10", code: "UX-10", name: "騎士圓甲", en: "KnightMail", series: "UX", tier: "" },
    { id: "ux-11", code: "UX-11", name: "衝擊龍神", en: "ImpactDrake", series: "UX", tier: "" },
    { id: "ux-14", code: "UX-14", name: "天蠍長矛", en: "ScorpioSpear", series: "UX", tier: "" },
    { id: "ux-15", code: "UX-15", name: "鮫鯊狂鱗", en: "SharkScale", series: "UX", tier: "T0" },
    { id: "ux-16", code: "UX-16", name: "時鐘幻影", en: "ClockMirage", series: "UX", tier: "T1" },
    { id: "ux-17", code: "UX-17", name: "隕星龍騎士", en: "MeteorDragoon", series: "UX", tier: "T0" },
    // UX-19 起新 UX 一體化固鎖（登記時無需另選固鎖）
    { id: "ux-19", code: "UX-19", name: "子彈獅鷲", en: "BulletGriffon", series: "UX", tier: "T1", integratedRatchet: true },
    { id: "ux-20", code: "UX-20", name: "榮耀戰神", en: "GloryValkyrie", series: "UX", tier: "T0", integratedRatchet: true },
    { id: "ux-21", code: "UX-21", name: "惡魔幽冥", en: "HellsNether", series: "UX", tier: "T1", integratedRatchet: true },
    // UX-21-03：雖屬 UX21 系，但非一體化固鎖（exception · 必須選固鎖）
    {
      id: "ux-21-03",
      code: "UX-21-03",
      name: "薯片龍",
      en: "ChipDragon",
      series: "UX",
      tier: "T0",
      integratedRatchet: false,
      staffCode: "UX-21-03",
    },

    // ── 活動限制但列表未列全者（OTHER，仍可選）──
    { id: "t0-pegasus-blast", code: "T0", name: "天馬爆擊", en: "PegasusBlast", series: "OTHER", tier: "T0" },
    { id: "t0-aero-pegasus", code: "T0", name: "空力天馬", en: "AeroPegasus", series: "OTHER", tier: "T0", staffCode: "UX00" },
    { id: "t0-emperor-crest", code: "T0", name: "帝王紋章", en: "EmperorCrest", series: "OTHER", tier: "T0" },
    { id: "t0-war-crest", code: "T0", name: "戰神紋章", en: "WarCrest", series: "OTHER", tier: "T0" },
  ],

  /**
   * 上蓋熱門選單（現場快速點選）
   * bladeId 對應 blades[]；label 為畫面顯示
   */
  bladesHot: [
    { bladeId: "bx-00-dransword-v2", label: "BX00-V2 蒼龍神劍 V2" },
    { bladeId: "bx-23", label: "BX23 鳳凰飛翼" },
    { bladeId: "bx-34", label: "BX34 蒼穹龍騎士" },
    { bladeId: "bx-49", label: "BX49 蒼龍突擊" },
    { bladeId: "t0-aero-pegasus", label: "UX00 空力天馬" },
    { bladeId: "ux-03", label: "UX03 魔導神杖" },
    { bladeId: "ux-15", label: "UX15 鮫鯊狂鱗" },
    { bladeId: "ux-16", label: "UX16 時鐘幻影" },
    { bladeId: "ux-17", label: "UX17 隕星龍騎士" },
    { bladeId: "ux-19", label: "UX19 子彈獅鷲" },
    { bladeId: "ux-20", label: "UX20 榮耀戰神" },
    { bladeId: "ux-21", label: "UX21 惡魔幽冥" },
    { bladeId: "ux-21-03", label: "UX-21-03 薯片龍" },
  ],

  /** 固鎖完整列表 */
  ratchets: [
    "0-60", "0-70", "0-80",
    "1-50", "1-60", "1-70", "1-80",
    "2-60", "2-70", "2-80",
    "3-60", "3-70", "3-80", "3-85",
    "4-50", "4-55", "4-60", "4-70", "4-80",
    "5-60", "5-70", "5-80",
    "6-60", "6-70", "6-80",
    "7-55", "7-60", "7-70", "7-80",
    "8-70", "8-80",
    "9-60", "9-65", "9-70", "9-80",
    "M-85",
    "簡易固鎖",
  ],

  /** 常用固鎖（快速 checkbox，現場優先） */
  ratchetsFrequent: [
    "1-50", "1-60", "1-70",
    "3-60", "3-70",
    "4-50",
    "5-60", "5-70",
    "6-60",
    "7-60", "7-70",
    "9-60",
    "簡易固鎖",
  ],

  /**
   * 固鎖按系分行（完整列表；畫面顯示全部，唔使 scroll 再揀）
   */
  ratchetsBySeries: [
    { label: "0", items: ["0-60", "0-70", "0-80"] },
    { label: "1", items: ["1-50", "1-60", "1-70", "1-80"] },
    { label: "2", items: ["2-60", "2-70", "2-80"] },
    { label: "3", items: ["3-60", "3-70", "3-80", "3-85"] },
    { label: "4", items: ["4-50", "4-55", "4-60", "4-70", "4-80"] },
    { label: "5", items: ["5-60", "5-70", "5-80"] },
    { label: "6", items: ["6-60", "6-70", "6-80"] },
    { label: "7", items: ["7-55", "7-60", "7-70", "7-80"] },
    { label: "8", items: ["8-70", "8-80"] },
    { label: "9", items: ["9-60", "9-65", "9-70", "9-80"] },
    { label: "M", items: ["M-85"] },
    { label: "其他", items: ["簡易固鎖"] },
  ],

  /** 軸心完整列表（只顯示代碼） */
  bits: [
    "F", "LF", "R", "A", "Q", "C", "L", "LR", "V", "GR", "Tr", "UF", "J", "FF", "RA",
    "T", "HT", "P", "GP", "H", "U", "E", "TP", "M", "K", "Z", "Op", "I",
    "B", "O", "GB", "DB", "G", "FB", "LO", "WB", "W",
    "N", "HN", "S", "GN", "MN", "UN", "BS", "Nr", "NR", "DS", "GU",
  ],

  /** 常用軸心（快速 checkbox） */
  bitsFrequent: [
    "LR", "R", "UF", "FF", "J", "L", "K", "H", "E", "NR", "B", "FB", "LO", "O", "P",
  ],

  /**
   * 軸心快速選擇：按系列分行
   */
  bitsBySeries: [
    { label: "Rubber", items: ["R", "LR"] },
    { label: "Flat", items: ["F", "FF", "LF", "UF"] },
    { label: "尖／釘", items: ["J", "L", "K"] },
    { label: "Ball", items: ["B", "FB", "DB", "NR"] },
    { label: "Orb", items: ["O", "LO"] },
    { label: "其他常用", items: ["H", "E", "W", "M"] },
  ],

  /**
   * CX 系列組件
   * 標準 CX（≤CX12）：鎖定紋章 + 主刃 + 輔助戰刃
   * Expand CX（≥CX13）：鎖定紋章 + 金屬戰刃 + 超越戰刃 + 輔助戰刃
   */
  cx: {
    /** 產品編號 → 類型；未列但 ≥13 視為 expand */
    products: [
      { code: "CX-01", compact: "CX01", type: "standard" },
      { code: "CX-02", compact: "CX02", type: "standard" },
      { code: "CX-03", compact: "CX03", type: "standard" },
      { code: "CX-04", compact: "CX04", type: "standard" },
      { code: "CX-05", compact: "CX05", type: "standard" },
      { code: "CX-06", compact: "CX06", type: "standard" },
      { code: "CX-07", compact: "CX07", type: "standard" },
      { code: "CX-08", compact: "CX08", type: "standard" },
      { code: "CX-09", compact: "CX09", type: "standard" },
      { code: "CX-10", compact: "CX10", type: "standard" },
      { code: "CX-11", compact: "CX11", type: "standard" },
      { code: "CX-12", compact: "CX12", type: "standard" },
      { code: "CX-13", compact: "CX13", type: "expand" },
      { code: "CX-14", compact: "CX14", type: "expand" },
      { code: "CX-15", compact: "CX15", type: "expand" },
      { code: "CX-16", compact: "CX16", type: "expand" },
      { code: "CX-17", compact: "CX17", type: "expand" },
      { code: "CX-18", compact: "CX18", type: "expand" },
    ],

    lockChips: [
      { name: "蒼龍", en: "Dran" },
      { name: "魔導", en: "Wizard" },
      { name: "英仙", en: "Perseus" },
      { name: "惡魔", en: "Hells" },
      { name: "騎士", en: "Knight" },
      { name: "龍王", en: "Bahamut" },
      { name: "鳳凰", en: "Phoenix" },
      { name: "獅王", en: "Leon" },
      { name: "天馬", en: "Pegasus" },
      { name: "極狐", en: "Fox" },
      { name: "戰神", en: "Valkyrie" },
      { name: "帝王", en: "Emperor" },
      { name: "巨鯨", en: "Whale" },
      { name: "戰犀", en: "Rhino" },
      { name: "狼", en: "Wolf" },
      { name: "三頭犬", en: "Cerberus" },
      { name: "邪神", en: "Ragna" },
      { name: "獨角獸", en: "Unicorn" },
      { name: "腕龍", en: "Brachio" },
      { name: "黃蜂", en: "Hornet" },
      { name: "海怪", en: "Kraken" },
      { name: "雄鹿", en: "Stag" },
      { name: "太陽", en: "Sol" },
    ],

    /** 標準主刃 */
    mainBlades: [
      { name: "勇氣", en: "Brave" },
      { name: "至尊", en: "Arc" },
      { name: "幽冥", en: "Dark" },
      { name: "獵魂", en: "Reaper" },
      { name: "九尾", en: "Brush" },
      { name: "爆擊", en: "Blast" },
      { name: "烈焰", en: "Flame" },
      { name: "日蝕", en: "Eclipse" },
      { name: "狩獵", en: "Hunt" },
      { name: "威能", en: "Might" },
      { name: "獠牙", en: "Fang" },
      { name: "伏特", en: "Volt" },
    ],

    /** Expand 金屬戰刃 */
    metalBlades: [
      { name: "閃擊", en: "Blitz" },
      { name: "要塞", en: "Fortress" },
      { name: "狂怒", en: "Rage" },
      { name: "三角", en: "Delta" },
      { name: "鞭打", en: "Whip" },
    ],

    /** 輔助戰刃 — UI 只顯示代碼 */
    assistBlades: [
      { code: "S" }, { code: "R" }, { code: "B" }, { code: "T" },
      { code: "C" }, { code: "J" }, { code: "A" }, { code: "W" },
      { code: "D" }, { code: "F" }, { code: "H" }, { code: "K" },
      { code: "M" }, { code: "V" }, { code: "E" }, { code: "Z" },
      { code: "O" }, { code: "G" },
    ],

    /** 超越戰刃（僅 Expand）— UI 只顯示代碼 */
    overBlades: [
      { code: "B" }, { code: "G" }, { code: "F" }, { code: "P" }, { code: "O" },
    ],
  },
};

const SERIES_LABELS = {
  HOT: "熱門",
  ALL: "全部",
  BX: "BX 系列",
  UX: "UX 系列",
  CX: "CX 系列",
  BXG: "BXG／聯名",
  OTHER: "其他",
};

function emptyCxParts() {
  return {
    cxProduct: "",
    cxType: "standard", // standard | expand
    lockChip: "",
    lockChipCustom: "",
    mainBlade: "",
    mainBladeCustom: "",
    assistBlade: "",
    overBlade: "",
  };
}

function emptyBey() {
  return {
    bladeId: "",
    bladeCode: "",
    bladeName: "",
    bladeEn: "",
    series: "",
    bladeCustom: "",
    ratchet: "",
    bit: "",
    ...emptyCxParts(),
  };
}

function emptyBeys() {
  return [emptyBey(), emptyBey(), emptyBey()];
}

function normalizePlayer(p) {
  if (!p.beys || !Array.isArray(p.beys) || p.beys.length !== 3) {
    p.beys = emptyBeys();
  } else {
    p.beys = p.beys.map((b) => normalizeBey(b));
    while (p.beys.length < 3) p.beys.push(emptyBey());
    p.beys = p.beys.slice(0, 3);
  }
  if (typeof p.deckChecked !== "boolean") p.deckChecked = false;
  if (typeof p.late !== "boolean") p.late = false;
  if (p.lateAt != null && p.lateAt !== "") p.lateAt = String(p.lateAt);
  if (p.nameAt != null && p.nameAt !== "") p.nameAt = String(p.nameAt);
  return p;
}

/** 相容舊版字串結構 */
function normalizeBey(b) {
  if (!b || typeof b !== "object") return emptyBey();
  const out = emptyBey();

  // 新結構
  if (b.bladeId || b.bladeCode || b.bladeName || b.bladeCustom || b.series === "CX" || b.lockChip) {
    out.bladeId = b.bladeId || "";
    out.bladeCode = b.bladeCode || "";
    out.bladeName = b.bladeName || "";
    out.bladeEn = b.bladeEn || "";
    out.series = b.series || "";
    out.bladeCustom = b.bladeCustom || "";
    out.ratchet = b.ratchet || "";
    out.bit = normalizeBitCode(b.bit || "");
    // CX fields
    out.cxProduct = b.cxProduct || "";
    out.cxType = b.cxType === "expand" ? "expand" : b.cxType === "standard" ? "standard" : "";
    out.lockChip = b.lockChip || "";
    out.lockChipCustom = b.lockChipCustom || "";
    out.mainBlade = b.mainBlade || "";
    out.mainBladeCustom = b.mainBladeCustom || "";
    out.assistBlade = (b.assistBlade || "").toUpperCase();
    out.overBlade = (b.overBlade || "").toUpperCase();
    if (out.series === "CX" || out.lockChip || out.cxProduct) {
      out.series = "CX";
      out.bladeId = out.bladeId || "cx";
      if (!out.cxType) {
        out.cxType = resolveCxType(out.cxProduct) || "standard";
      }
      syncCxDisplayFields(out);
    }
    return out;
  }

  // 舊結構：blade / ratchet / bit 字串 + *Custom
  out.ratchet = b.ratchet || "";
  out.bit = normalizeBitCode(stripBitName(b.bit || ""));
  const oldBlade = (b.blade || "").trim();
  if (oldBlade.includes("其他") || oldBlade === "其他（自填）") {
    out.bladeId = "custom";
    out.series = "OTHER";
    out.bladeCustom = b.bladeCustom || "";
    out.bladeName = out.bladeCustom;
  } else if (oldBlade) {
    const found = findBladeByQuery(oldBlade);
    if (found) {
      applyBladeToBey(out, found);
    } else {
      out.bladeId = "custom";
      out.series = "OTHER";
      out.bladeCustom = b.bladeCustom || oldBlade;
      out.bladeName = out.bladeCustom;
    }
  }
  return out;
}

function resolveCxType(productCode) {
  if (!productCode) return null;
  const n = normalizeCodeQuery(productCode);
  const hit = PARTS.cx.products.find(
    (p) => p.compact === n || normalizeCodeQuery(p.code) === n
  );
  if (hit) return hit.type;
  const m = n.match(/^CX(\d{1,3})$/);
  if (m) {
    const num = parseInt(m[1], 10);
    if (num >= 13) return "expand";
    if (num >= 1) return "standard";
  }
  return null;
}

function cxLockDisplay(bey) {
  if ((bey.lockChip || "") === "__custom__") return (bey.lockChipCustom || "").trim();
  return (bey.lockChip || "").trim();
}

function cxMainDisplay(bey) {
  if ((bey.mainBlade || "") === "__custom__") return (bey.mainBladeCustom || "").trim();
  return (bey.mainBlade || "").trim();
}

/** 組出 CX 顯示字串：標準「蒼龍 勇氣 J」／Expand「龍王 閃擊 B K」 */
function cxComboLabel(bey, opts = {}) {
  const lock = cxLockDisplay(bey);
  const main = cxMainDisplay(bey);
  const assist = (bey.assistBlade || "").toUpperCase();
  const over = (bey.overBlade || "").toUpperCase();
  const type = bey.cxType || resolveCxType(bey.cxProduct) || "standard";
  const parts = [];
  if (opts.withProduct && bey.cxProduct) {
    parts.push(normalizeCodeQuery(bey.cxProduct) || bey.cxProduct);
  }
  if (lock) parts.push(lock);
  if (main) parts.push(main);
  if (type === "expand") {
    if (over) parts.push(over);
    if (assist) parts.push(assist);
  } else {
    if (assist) parts.push(assist);
  }
  return parts.join(" ") || "";
}

function syncCxDisplayFields(bey) {
  if (bey.series !== "CX") return bey;
  const label = cxComboLabel(bey);
  bey.bladeName = label;
  bey.bladeCode = bey.cxProduct ? normalizeCodeQuery(bey.cxProduct) : "CX";
  bey.bladeEn = bey.cxType === "expand" ? "Expand" : "Standard";
  bey.bladeCustom = label;
  return bey;
}

function isCxBladeComplete(bey) {
  if (bey.series !== "CX" && bey.bladeId !== "cx") return false;
  const lock = cxLockDisplay(bey);
  const main = cxMainDisplay(bey);
  const assist = (bey.assistBlade || "").trim();
  const type = bey.cxType || resolveCxType(bey.cxProduct) || "standard";
  if (!lock || !main || !assist) return false;
  if (type === "expand" && !(bey.overBlade || "").trim()) return false;
  return true;
}

/**
 * 軸心英文全名 → 官方代碼（介面只顯示代碼，例如 Orb → O）
 */
const BIT_NAME_TO_CODE = {
  // English full names
  flat: "F",
  "low flat": "LF",
  lowflat: "LF",
  rush: "R",
  accel: "A",
  quake: "Q",
  cyclone: "C",
  level: "L",
  "level reverse": "LR",
  levelreverse: "LR",
  reverse: "LR",
  vortex: "V",
  "gear rush": "GR",
  gearrush: "GR",
  taper: "T",
  "high taper": "HT",
  hightaper: "HT",
  point: "P",
  "gear point": "GP",
  gearpoint: "GP",
  "high ball": "H",
  highball: "H",
  ball: "B",
  unite: "U",
  elevate: "E",
  "trans point": "TP",
  transpoint: "TP",
  merge: "M",
  kick: "K",
  zap: "Z",
  "over point": "Op",
  overpoint: "Op",
  infinite: "I",
  orb: "O",
  "gear ball": "GB",
  gearball: "GB",
  "disk ball": "DB",
  diskball: "DB",
  "gear flat": "G",
  gearflat: "G",
  "free ball": "FB",
  freeball: "FB",
  "low orb": "LO",
  loworb: "LO",
  "wall ball": "WB",
  wallball: "WB",
  needle: "N",
  "high needle": "HN",
  highneedle: "HN",
  spike: "S",
  "gear needle": "GN",
  gearneedle: "GN",
  "metal needle": "MN",
  metalneedle: "MN",
  "under needle": "UN",
  underneedle: "UN",
  "ball spike": "BS",
  ballspike: "BS",
  "dot spike": "DS",
  "gear unite": "GU",
  gearunite: "GU",
  "ultra flat": "UF",
  ultraflat: "UF",
  "rubber accel": "RA",
  rubberaccel: "RA",
  hexa: "H",
  // Chinese legacy
  "平 (ball)": "B",
  "針 (needle)": "N",
  "尖 (point)": "P",
  "斜 (taper)": "T",
  "尖針 (spike)": "S",
  "平底 (flat)": "F",
  "低平 (low flat)": "LF",
  "高平 (high ball)": "H",
  "加速 (accel)": "A",
  "橡膠加速 (r.accel)": "RA",
  "齒輪平 (gear ball)": "GB",
  "齒輪尖 (gear point)": "GP",
  "齒輪平地 (gear flat)": "G",
  "齒輪針 (gear needle)": "GN",
  "自由平 (free ball)": "FB",
  平: "B",
  針: "N",
  尖: "P",
  斜: "T",
  球: "O",
  orb: "O",
};

function stripBitName(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";
  // "平 (Ball)" / "Orb (O)" → 括號內若係代碼優先
  const paren = raw.match(/\(([A-Za-z0-9]+)\)\s*$/);
  if (paren) {
    const inner = paren[1];
    const asCode = PARTS.bits.find((x) => x.toLowerCase() === inner.toLowerCase());
    if (asCode) return asCode;
  }
  // 括號前的英文名
  const beforeParen = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return beforeParen || raw;
}

/** 正規化為官方軸心代碼（只存／只顯示 O，唔顯示 Orb） */
function normalizeBitCode(code) {
  let c = String(code || "").trim();
  if (!c) return "";
  c = stripBitName(c);

  // Nr / NR 統一
  if (c.toLowerCase() === "nr") return "NR";

  // 已是合法代碼（優先 bitsFrequent 常用寫法）
  const exact = PARTS.bits.find((x) => x.toLowerCase() === c.toLowerCase());
  if (exact) {
    // 顯示偏好：NR 大寫
    if (exact.toLowerCase() === "nr") return "NR";
    return exact;
  }

  // 英文／中文全名 → 代碼
  const key = c.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const mapped = BIT_NAME_TO_CODE[key] || BIT_NAME_TO_CODE[key.replace(/\s/g, "")];
  if (mapped) {
    const hit = PARTS.bits.find((x) => x.toLowerCase() === mapped.toLowerCase());
    return hit || mapped;
  }

  // 若誤存 "Orb" 等，再試只取首個大寫字母組
  const letters = c.replace(/[^A-Za-z]/g, "");
  if (letters) {
    const hit2 = PARTS.bits.find((x) => x.toLowerCase() === letters.toLowerCase());
    if (hit2) return hit2;
  }
  return c.toUpperCase();
}

function findBladeById(id) {
  return PARTS.blades.find((b) => b.id === id) || null;
}

/**
 * 精簡編號：BX-49 → BX49、UX-15 → UX15（工作人員主要輸入格式）
 */
function bladeCompactCode(bladeOrCode) {
  if (!bladeOrCode) return "";
  const code = typeof bladeOrCode === "string" ? bladeOrCode : bladeOrCode.code;
  if (!code || code === "T0" || code === "T1") return code || "";
  // BX-49 / UX-01 → BX49 / UX01（保留前導零較易對表；另提供無前導零鍵）
  return String(code).replace(/-/g, "").toUpperCase();
}

/** BX49 / bx-49 / BX 49 / ux15 → 正規化為可比對字串 */
function normalizeCodeQuery(q) {
  return String(q || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

/** 從輸入抽出系列+數字：BX49、UX15、49（僅數字則靠 series filter） */
function parseCompactBladeQuery(q) {
  const n = normalizeCodeQuery(q);
  if (!n) return null;
  const m = n.match(/^(BX|UX|CX)(\d{1,3})$/i);
  if (m) {
    return { series: m[1].toUpperCase(), num: String(parseInt(m[2], 10)), raw: n };
  }
  if (/^\d{1,3}$/.test(n)) {
    return { series: null, num: String(parseInt(n, 10)), raw: n };
  }
  return null;
}

function bladeMatchesCompact(blade, compactQuery) {
  if (!blade || !compactQuery) return false;
  const compact = bladeCompactCode(blade); // e.g. BX49
  const n = normalizeCodeQuery(compactQuery);
  if (!n) return false;
  if (compact === n) return true;
  // BX049 vs BX49
  const parsed = parseCompactBladeQuery(n);
  if (!parsed) return compact.includes(n) || n.includes(compact);
  if (parsed.series && blade.series !== parsed.series && blade.code.indexOf(parsed.series) !== 0) {
    // series mismatch
    if (blade.series !== parsed.series) return false;
  }
  const bladeNum = String(blade.code).replace(/^[A-Z]+-?/i, "").replace(/^0+/, "") || "0";
  const qNum = String(parsed.num).replace(/^0+/, "") || "0";
  if (parsed.series) {
    return blade.series === parsed.series && bladeNum === qNum;
  }
  return bladeNum === qNum;
}

function findBladeByQuery(q) {
  const t = String(q || "").trim();
  if (!t) return null;
  const compact = normalizeCodeQuery(t);

  // CX 產品碼 → 回傳虛擬 blade 物件（由 UI 處理組件）
  if (/^CX\d{1,3}$/i.test(compact)) {
    const type = resolveCxType(compact) || "standard";
    return {
      id: "cx",
      code: compact.replace(/^(CX)(\d+)$/i, (_, s, n) => `CX-${parseInt(n, 10)}`),
      name: type === "expand" ? "Expand CX" : "Standard CX",
      en: type === "expand" ? "Expand" : "Standard",
      series: "CX",
      tier: "",
      cxType: type,
      compact,
    };
  }

  // 1) 精確精簡碼：BX49、UX15
  const exactCompact = PARTS.blades.find((b) => bladeCompactCode(b) === compact);
  if (exactCompact) return exactCompact;

  // 2) 系列+數字（容忍前導零）
  const byCompact = PARTS.blades.find((b) => bladeMatchesCompact(b, t));
  if (byCompact) return byCompact;

  const lower = t.toLowerCase();
  return (
    PARTS.blades.find(
      (b) =>
        b.id === lower ||
        b.code.toLowerCase() === lower ||
        b.name.toLowerCase() === lower ||
        b.en.toLowerCase() === lower ||
        `${b.code} ${b.name}`.toLowerCase() === lower ||
        bladeFullLabel(b).toLowerCase() === lower
    ) ||
    PARTS.blades.find(
      (b) =>
        b.name.includes(t) ||
        b.en.toLowerCase().includes(lower) ||
        b.code.toLowerCase().includes(lower) ||
        bladeCompactCode(b).toLowerCase().includes(compact.toLowerCase())
    ) ||
    null
  );
}

function applyBladeToBey(bey, blade) {
  bey.bladeId = blade.id;
  bey.bladeCode = blade.code;
  bey.bladeName = blade.name;
  bey.bladeEn = blade.en;
  bey.series = blade.series;
  bey.bladeCustom = "";
  // 清除 CX 組件
  Object.assign(bey, emptyCxParts());
  // 新 UX 一體化固鎖：自動標記，無需人手選
  if (bladeHasIntegratedRatchet(blade)) {
    bey.ratchet = INTEGRATED_RATCHET_LABEL;
  } else if (bey.ratchet === INTEGRATED_RATCHET_LABEL) {
    bey.ratchet = "";
  }
}

/** 一體化固鎖（UX-19／20／21 等）顯示用標籤 */
const INTEGRATED_RATCHET_LABEL = "一體化";

/**
 * 上蓋是否使用一體化固鎖（無需另選 Ratchet）
 * 注意：UX-21-03 雖係 UX21 系，但 integratedRatchet=false（要選固鎖）
 */
function bladeHasIntegratedRatchet(blade) {
  if (!blade) return false;
  // 以旗標為準（false 明確排除 exception）
  if (blade.integratedRatchet === false) return false;
  if (blade.integratedRatchet === true) return true;
  const id = String(blade.id || "").toLowerCase();
  const code = normalizeCodeQuery(blade.code || "");
  // 只精確匹配 UX-19／20／21 本體，唔包 UX-21-03
  return (
    id === "ux-19" ||
    id === "ux-20" ||
    id === "ux-21" ||
    code === "UX19" ||
    code === "UX20" ||
    code === "UX21"
  );
}

function beyHasIntegratedRatchet(bey) {
  if (!bey) return false;
  // 先查零件庫旗標（處理 UX-21-03 exception）
  if (bey.bladeId && bey.bladeId !== "custom" && bey.bladeId !== "cx") {
    const b = findBladeById(bey.bladeId);
    if (b) {
      if (b.integratedRatchet === false) return false;
      if (bladeHasIntegratedRatchet(b)) return true;
    }
  }
  // 已存「一體化」但上蓋係 exception → 唔算一體化
  const code = normalizeCodeQuery(bey.bladeCode || bey.staffCode || "");
  if (code === "UX2103" || /^UX21\d/.test(code)) {
    return false;
  }
  if (bey.ratchet === INTEGRATED_RATCHET_LABEL) {
    // 再確認唔係 exception 上蓋顯示名
    const short = normalizeCodeQuery(partDisplayBladeShort(bey) || "");
    if (short === "UX2103" || /^UX21\d/.test(short)) return false;
    return true;
  }
  // 後備：自填／代碼 — 只精確 UX19／20／21
  const fallback = normalizeCodeQuery(bey.bladeCode || partDisplayBladeShort(bey) || "");
  return fallback === "UX19" || fallback === "UX20" || fallback === "UX21";
}

function applyCxProductToBey(bey, compactOrCode) {
  const type = resolveCxType(compactOrCode) || "standard";
  const n = normalizeCodeQuery(compactOrCode);
  const hit = PARTS.cx.products.find((p) => p.compact === n || normalizeCodeQuery(p.code) === n);
  bey.series = "CX";
  bey.bladeId = "cx";
  bey.cxProduct = hit ? hit.compact : n;
  bey.cxType = hit ? hit.type : type;
  // 切換類型時，Expand→Standard 清超越戰刃
  if (bey.cxType !== "expand") bey.overBlade = "";
  syncCxDisplayFields(bey);
  return bey;
}

/** 工作人員用短標籤：BX49／UX-21-03 */
function bladeStaffLabel(blade) {
  if (!blade) return "";
  if (blade.staffCode) return blade.staffCode;
  if (blade.series === "OTHER" || blade.code === "T0" || blade.code === "T1") {
    return blade.name;
  }
  return bladeCompactCode(blade);
}

function bladeFullLabel(blade) {
  if (!blade) return "";
  if (blade.series === "OTHER" || blade.code === "T0" || blade.code === "T1") {
    // 有 staffCode（如 UX00）時一併顯示
    if (blade.staffCode) return `${blade.staffCode} ${blade.name}`;
    return `${blade.name} (${blade.en})`;
  }
  // 顯示精簡碼為主：BX49 蒼龍突擊／UX-21-03 薯片龍
  const code = blade.staffCode || bladeCompactCode(blade);
  return `${code} ${blade.name}`;
}

/** 顯示用上蓋名稱（完整） */
function partDisplayBlade(bey) {
  if (!bey) return "";
  if (bey.series === "CX" || bey.bladeId === "cx") {
    const combo = cxComboLabel(bey, { withProduct: true });
    if (combo) return combo;
    return (bey.bladeCustom || bey.bladeName || "").trim();
  }
  if (bey.bladeId === "custom") {
    return (bey.bladeCustom || bey.bladeName || "").trim();
  }
  if (bey.bladeId) {
    const b = findBladeById(bey.bladeId);
    if (b) return bladeFullLabel(b);
  }
  if (bey.bladeCode && bey.bladeName) {
    if (bey.bladeCode === "T0" || bey.bladeCode === "T1") {
      return `${bey.bladeName}${bey.bladeEn ? ` (${bey.bladeEn})` : ""}`;
    }
    return `${bey.bladeCode} ${bey.bladeName}${bey.bladeEn ? ` (${bey.bladeEn})` : ""}`;
  }
  return (bey.bladeName || bey.bladeCustom || "").trim();
}

/** 短名（用於組合顯示）— BX49 或 CX 組合「蒼龍 勇氣 J」 */
function partDisplayBladeShort(bey) {
  if (!bey) return "";
  if (bey.series === "CX" || bey.bladeId === "cx") {
    return cxComboLabel(bey) || (bey.bladeCustom || "").trim() || "CX";
  }
  if (bey.bladeId === "custom") {
    return (bey.bladeCustom || bey.bladeName || "").trim();
  }
  if (bey.bladeId) {
    const b = findBladeById(bey.bladeId);
    if (b) return bladeStaffLabel(b);
  }
  if (bey.bladeCode && bey.bladeCode !== "T0" && bey.bladeCode !== "T1") {
    return bladeCompactCode(bey.bladeCode);
  }
  if (bey.bladeName) return bey.bladeName;
  return partDisplayBlade(bey);
}

function partDisplay(bey, field) {
  if (field === "blade") return partDisplayBlade(bey);
  if (field === "ratchet") {
    if (beyHasIntegratedRatchet(bey)) {
      const r = (bey?.ratchet || "").trim();
      // 已選一般固鎖時仍顯示該值；否則顯示一體化
      if (r && r !== INTEGRATED_RATCHET_LABEL) return r;
      return INTEGRATED_RATCHET_LABEL;
    }
    return (bey?.ratchet || "").trim();
  }
  // 軸心：永遠只顯示代碼（O），絕不顯示全名（Orb）
  if (field === "bit") return normalizeBitCode(bey?.bit || "");
  return "";
}

/** 完整組合：BX49 3-60 J 或 BX49 蒼龍突擊 3-60 J */
function beyLabel(bey, opts = {}) {
  const rt = partDisplay(bey, "ratchet");
  const bt = partDisplay(bey, "bit");
  if (!partDisplayBlade(bey) && !rt && !bt) return "（未登記）";
  // 短顯示：BX49 3-60 J（現場主用）；一體化固鎖顯示 UX20 一體化 J
  if (opts.short) {
    const shortBl = partDisplayBladeShort(bey) || "?";
    return [shortBl, rt || "?", bt || "?"].join(" ");
  }
  // 完整：BX49 蒼龍突擊 3-60 J
  return [partDisplayBlade(bey) || "?", rt || "?", bt || "?"].join(" ");
}

function isBeyComplete(bey) {
  const bt = partDisplay(bey, "bit");
  if (!bt) return false;
  // UX-19／20／21：一體化固鎖，無需另選固鎖
  const needRatchet = !beyHasIntegratedRatchet(bey);
  if (needRatchet && !partDisplay(bey, "ratchet")) return false;
  if (bey.series === "CX" || bey.bladeId === "cx") {
    return isCxBladeComplete(bey);
  }
  const bl = partDisplayBlade(bey);
  return !!bl;
}

function isDeckComplete(player) {
  return player.beys && player.beys.length === 3 && player.beys.every(isBeyComplete);
}

function deckProgress(player) {
  if (!player.beys) return 0;
  return player.beys.filter(isBeyComplete).length;
}

function getBeyTier(bey) {
  if (!bey) return "";
  // 自訂上蓋永不計 T0／T1
  if (bey.bladeId === "custom") return "";
  if (bey.bladeId && bey.bladeId !== "cx") {
    const b = findBladeById(bey.bladeId);
    if (b) return b.tier || "";
  }
  return "";
}

/** 檢查本活動 T0/T1 限制 */
function checkDeckRestrictions(player) {
  const warnings = [];
  const blades = (player.beys || [])
    .map((b) => ({
      full: partDisplayBlade(b),
      short: partDisplayBladeShort(b),
      tier: getBeyTier(b),
      id: b.bladeId || partDisplayBlade(b),
    }))
    .filter((x) => x.full);

  let t0 = 0;
  let t1 = 0;
  const seen = new Set();
  for (const b of blades) {
    const key = b.short || b.full;
    if (seen.has(key)) warnings.push(`上蓋「${key}」重複使用`);
    seen.add(key);
    if (b.tier === "T0") t0++;
    if (b.tier === "T1") t1++;
  }
  if (t0 > 1) warnings.push(`T0 上蓋超過 1 隻（目前 ${t0}）`);
  if (t0 >= 1 && t1 > 1) warnings.push(`已用 T0 時，T1 最多 1 隻（目前 T1：${t1}）`);
  if (t0 === 0 && t1 > 2) warnings.push(`無 T0 時，T1 最多 2 隻（目前 ${t1}）`);

  // 一體化固鎖不計入「固鎖重複」檢查
  const ratchets = (player.beys || [])
    .filter((b) => !beyHasIntegratedRatchet(b))
    .map((b) => partDisplay(b, "ratchet"))
    .filter(Boolean);
  const bits = (player.beys || []).map((b) => partDisplay(b, "bit")).filter(Boolean);
  const rSet = new Set();
  for (const r of ratchets) {
    if (rSet.has(r)) warnings.push(`固鎖「${r}」重複`);
    rSet.add(r);
  }
  const bSet = new Set();
  for (const bit of bits) {
    if (bSet.has(bit)) warnings.push(`軸心「${bit}」重複`);
    bSet.add(bit);
  }
  return warnings;
}

function filterBlades(series, query) {
  let list = PARTS.blades.slice();
  // HOT 等同 ALL（熱門有獨立 UI；防誤傳 series=HOT）
  if (series === "BXG") {
    list = list.filter((b) => b.series === "BXG" || b.series === "COLLAB");
  } else if (series && series !== "ALL" && series !== "CX" && series !== "HOT") {
    list = list.filter((b) => b.series === series);
  }
  if (series === "CX") {
    // CX 產品列表
    return PARTS.cx.products
      .filter((p) => {
        if (!query) return true;
        const n = normalizeCodeQuery(query);
        return p.compact.includes(n) || normalizeCodeQuery(p.code).includes(n) || p.type.includes(String(query).toLowerCase());
      })
      .map((p) => ({
        id: "cx-" + p.compact.toLowerCase(),
        code: p.code,
        name: p.type === "expand" ? "Expand（需超越戰刃）" : "標準 CX",
        en: p.type,
        series: "CX",
        tier: "",
        cxType: p.type,
        compact: p.compact,
      }));
  }
  const raw = String(query || "").trim();
  if (!raw) return list;

  const compact = normalizeCodeQuery(raw);
  const lower = raw.toLowerCase();
  const parsed = parseCompactBladeQuery(raw);

  // 有系列+數字時，優先精確／數字匹配（BX49、UX15）
  const scored = list
    .map((b) => {
      let score = 0;
      const bCompact = bladeCompactCode(b);
      if (bCompact === compact) score = 100;
      else if (bladeMatchesCompact(b, raw)) score = 90;
      else if (bCompact.startsWith(compact) || compact.startsWith(bCompact)) score = 70;
      else if (b.code.toLowerCase().includes(lower) || bCompact.includes(compact)) score = 50;
      else if (b.name.toLowerCase().includes(lower) || b.en.toLowerCase().includes(lower)) score = 30;
      else if (`${b.code} ${b.name}`.toLowerCase().includes(lower)) score = 20;
      else score = 0;
      // 僅輸入數字時，若已選系列 filter 則加強
      if (parsed && !parsed.series && series && series !== "ALL") {
        const bladeNum = String(b.code).replace(/^[A-Z]+-?/i, "").replace(/^0+/, "") || "0";
        if (bladeNum === parsed.num) score = Math.max(score, 85);
      }
      return { b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.b.code.localeCompare(b.b.code));

  return scored.map((x) => x.b);
}

function sortedBits() {
  // 常用列表（含 NR）；完整列表去重
  const freq = PARTS.bitsFrequent.map((c) => (c.toLowerCase() === "nr" ? "NR" : c));
  const freqLower = new Set(freq.map((c) => c.toLowerCase()));
  const rest = PARTS.bits
    .filter((c) => !freqLower.has(c.toLowerCase()) && c !== "Nr")
    .map((c) => (c.toLowerCase() === "nr" ? "NR" : c));
  // 確保常用代碼都可選（即使主列表漏咗）
  const allCodes = new Set([...PARTS.bits.map((c) => (c.toLowerCase() === "nr" ? "NR" : c)), ...freq]);
  return { freq, rest, all: [...allCodes] };
}
