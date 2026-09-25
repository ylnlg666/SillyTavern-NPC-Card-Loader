const TAG = "[NPC角色卡动态加载器]";

/*
 * v0.2 活跃角色加载
 * - @名字：强制加载，优先级最高
 * - 当前用户消息：主要识别来源
 * - 上一条AI消息：只用于维持仍在当前场景中的人物
 * - 更早历史不再自动扫描，避免旧人物一直占上下文
 * - 每轮最多4张卡
 * - 默认不注入 Scenario / Example Messages，减少旧剧情与Token污染
 */

const NPC_RULES = [
  { target: "伊蕾娜", aliases: ["伊蕾娜", "娜娜"] },
  { target: "公孙雅柔", aliases: ["公孙雅柔", "公孙雅", "公孙柔", "雅柔"] },
  { target: "露西亚", aliases: ["露西亚"] },
  { target: "芙宁娜", aliases: ["芙宁娜"] },
  { target: "千夏", aliases: ["千夏"] },
  { target: "cc", aliases: ["cc", "CC"] },
  { target: "EZ", aliases: ["EZ", "Ez", "ez"] },
];

const NARRATOR_NAMES = ["群像世界主持人"];
const MAX_CARDS_PER_TURN = 4;
const KEEP_FROM_PREVIOUS_AI = true;
const INCLUDE_SCENARIO = false;
const INCLUDE_EXAMPLE_MESSAGES = false;

const norm = v => String(v ?? "").trim().toLowerCase();
const cname = c => c?.name ?? c?.data?.name ?? "";

function field(c, ...keys) {
  for (const k of keys) {
    if (c?.[k] != null && String(c[k]).trim()) return String(c[k]).trim();
    if (c?.data?.[k] != null && String(c.data[k]).trim()) return String(c.data[k]).trim();
  }
  return "";
}

function findCharacter(chars, target) {
  const t = norm(target);
  return chars.find(c => norm(cname(c)) === t)
      || chars.find(c => norm(cname(c)).includes(t));
}

function containsAlias(text, alias) {
  if (!text || !alias) return false;
  // ASCII短名使用边界，避免cc/EZ误命中英文单词的一部分。
  if (/^[A-Za-z0-9_]+$/.test(alias)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`, "i").test(text);
  }
  return text.includes(alias);
}

function forcedAliases(text) {
  const hits = [];
  for (const r of NPC_RULES) {
    if (r.aliases.some(a => containsAlias(text, "@" + a))) hits.push(r);
  }
  return hits;
}

function normalAliases(text) {
  return NPC_RULES.filter(r => r.aliases.some(a => containsAlias(text, a)));
}

function buildCardPrompt(c) {
  const parts = [
    `【NPC角色卡动态加载：${cname(c)}】`,
    `以下内容来自SillyTavern中该NPC当前角色卡，是本轮扮演该NPC时的高优先级人物依据。
- 保持该NPC独立的人格、语气、价值判断、关系动态与能力边界。
- 职业/身份只是人格的一部分，不得把角色简化成单一职业动作。
- 最近聊天中偶然出现过的动作、笑点、照顾方式、口头禅，不自动成为永久习惯。
- 避免连续重复同类动作与表达；根据当前场景自然变化行为。
- NPC应有自然的动作、表情、视线、停顿、空间互动和对其他NPC的反应，但不要机械地每句都配动作。
- 不得用本卡覆盖用户最新明确设定或当前剧情已经发生的事实。`
  ];

  const description = field(c, "description");
  const personality = field(c, "personality");
  const systemPrompt = field(c, "system_prompt", "systemPrompt");
  const postHistory = field(c, "post_history_instructions", "postHistoryInstructions");
  const scenario = field(c, "scenario");
  const examples = field(c, "mes_example", "mesExample");

  if (description) parts.push(`【Description】\n${description}`);
  if (personality) parts.push(`【Personality】\n${personality}`);
  if (systemPrompt) parts.push(`【System Prompt】\n${systemPrompt}`);
  if (postHistory) parts.push(`【Post History Instructions】\n${postHistory}`);
  if (INCLUDE_SCENARIO && scenario) parts.push(`【Scenario】\n${scenario}`);
  if (INCLUDE_EXAMPLE_MESSAGES && examples) parts.push(`【Example Messages】\n${examples}`);

  return parts.join("\n\n");
}

globalThis.npcCardDynamicLoaderInterceptor = async function(chat, contextSize, abort, type) {
  try {
    const ctx = SillyTavern.getContext();
    const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
    const current = chars?.[ctx.characterId];
    const currentName = cname(current);

    if (NARRATOR_NAMES.length && !NARRATOR_NAMES.some(n => norm(n) === norm(currentName))) return;

    const clean = chat.filter(m => !String(m?.mes ?? "").startsWith("【NPC角色卡动态加载："));
    const lastUserIndex = [...clean].map(m => !!m?.is_user).lastIndexOf(true);
    if (lastUserIndex < 0) return;

    const userText = String(clean[lastUserIndex]?.mes ?? "");
    let previousAiText = "";
    for (let i = lastUserIndex - 1; i >= 0; i--) {
      if (!clean[i]?.is_user) {
        previousAiText = String(clean[i]?.mes ?? "");
        break;
      }
    }

    const orderedRules = [];
    const pushRule = r => {
      if (r && !orderedRules.some(x => x.target === r.target)) orderedRules.push(r);
    };

    // 1. @强制加载
    forcedAliases(userText).forEach(pushRule);
    // 2. 当前用户消息直接出现的人物
    normalAliases(userText).forEach(pushRule);
    // 3. 上一条AI消息中仍在场的人物，仅作为补充
    if (KEEP_FROM_PREVIOUS_AI) normalAliases(previousAiText).forEach(pushRule);

    const loaded = [];
    const missing = [];

    for (const rule of orderedRules.slice(0, MAX_CARDS_PER_TURN)) {
      const c = findCharacter(chars, rule.target);
      if (c) loaded.push(c);
      else missing.push(rule.target);
    }

    if (!loaded.length) {
      if (missing.length) console.warn(`${TAG} 命中但未找到角色卡：${missing.join(", ")}`);
      return;
    }

    const note = {
      is_user: false,
      name: "NPC Card Loader",
      send_date: Date.now(),
      mes: loaded.map(buildCardPrompt).join("\n\n---\n\n"),
      extra: { npc_card_dynamic_loader: true }
    };

    // 放在最后一条用户消息之前：只影响本轮生成副本，不永久写入聊天。
    const insertAt = Math.max(0, chat.length - 1);
    chat.splice(insertAt, 0, note);

    console.log(`${TAG} v0.2 本轮加载：${loaded.map(cname).join(", ")}`);
    if (missing.length) console.warn(`${TAG} 未找到角色卡：${missing.join(", ")}`);
  } catch (e) {
    console.error(`${TAG} v0.2运行失败`, e);
  }
};

console.log(`${TAG} v0.2 已加载`);
