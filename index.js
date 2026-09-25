const TAG = "[NPC角色卡动态加载器]";
const NPC_RULES = [
  { target:"伊蕾娜", aliases:["伊蕾娜","娜娜"] },
  { target:"公孙雅柔", aliases:["公孙雅柔","公孙雅","公孙柔","雅柔"] },
  { target:"露西亚", aliases:["露西亚"] },
  { target:"芙宁娜", aliases:["芙宁娜"] },
  { target:"千夏", aliases:["千夏"] },
  { target:"cc", aliases:["cc","CC"] },
  { target:"EZ", aliases:["EZ","Ez","ez"] },
];

const NARRATOR_NAMES=["群像世界主持人"];
const MAX_CARDS_PER_TURN=4;
const KEEP_FROM_PREVIOUS_AI=true;
const INCLUDE_SCENARIO=false;
const INCLUDE_EXAMPLE_MESSAGES=false;

const norm=v=>String(v??"").trim().toLowerCase();
const cname=c=>c?.name??c?.data?.name??"";

function setStatus(text, ok=true){
  let el=document.getElementById("npc-card-loader-status");
  if(!el){
    el=document.createElement("div");
    el.id="npc-card-loader-status";
    Object.assign(el.style,{
      position:"fixed", right:"12px", bottom:"82px", zIndex:"99999",
      maxWidth:"78vw", padding:"8px 11px", borderRadius:"10px",
      background:"rgba(20,20,20,.88)", color:"#fff", fontSize:"12px",
      lineHeight:"1.35", boxShadow:"0 2px 10px rgba(0,0,0,.35)",
      pointerEvents:"none", whiteSpace:"pre-wrap"
    });
    document.body.appendChild(el);
  }
  el.textContent="NPC Loader v0.3\n"+text;
  el.style.border=ok?"1px solid rgba(90,220,130,.8)":"1px solid rgba(255,100,100,.9)";
  clearTimeout(globalThis.__npcLoaderStatusTimer);
  globalThis.__npcLoaderStatusTimer=setTimeout(()=>{ if(el) el.style.opacity=".45"; },8000);
  el.style.opacity="1";
}

function field(c,...ks){
  for(const k of ks){
    if(c?.[k]!=null&&String(c[k]).trim()) return String(c[k]).trim();
    if(c?.data?.[k]!=null&&String(c.data[k]).trim()) return String(c.data[k]).trim();
  }
  return "";
}
function findChar(chars,target){
  const t=norm(target);
  return chars.find(c=>norm(cname(c))===t) || chars.find(c=>norm(cname(c)).includes(t));
}
function containsAlias(text,alias){
  if(!text||!alias)return false;
  if(/^[A-Za-z0-9_]+$/.test(alias)){
    const e=alias.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return new RegExp(`(^|[^A-Za-z0-9_])${e}([^A-Za-z0-9_]|$)`,"i").test(text);
  }
  return text.includes(alias);
}
function forced(text){
  return NPC_RULES.filter(r=>r.aliases.some(a=>containsAlias(text,"@"+a)));
}
function normal(text){
  return NPC_RULES.filter(r=>r.aliases.some(a=>containsAlias(text,a)));
}
function build(c){
  const p=[
    `【NPC角色卡动态加载：${cname(c)}】`,
`以下资料来自该NPC当前原始角色卡，是本轮扮演该NPC时的高优先级人物依据。
- 保持独立人格、语气、价值判断、关系动态与能力边界。
- 职业/身份不是唯一人格，不得退化成单一职业动作。
- 最近上下文中的偶发动作、笑点、照顾方式或口头禅，不自动成为永久习惯。
- 避免连续重复同类动作和表达；根据场景自然变化。
- 自然表现动作、表情、视线、停顿、空间互动以及对其他NPC的反应，但不要机械地每句附动作。
- 用户最新明确设定和当前已发生剧情事实优先。`
  ];
  const add=(n,v)=>{if(v)p.push(`【${n}】\n${v}`)};
  add("Description",field(c,"description"));
  add("Personality",field(c,"personality"));
  add("System Prompt",field(c,"system_prompt","systemPrompt"));
  add("Post History Instructions",field(c,"post_history_instructions","postHistoryInstructions"));
  if(INCLUDE_SCENARIO)add("Scenario",field(c,"scenario"));
  if(INCLUDE_EXAMPLE_MESSAGES)add("Example Messages",field(c,"mes_example","mesExample"));
  return p.join("\n\n");
}

globalThis.npcCardDynamicLoaderInterceptor=async function(chat,contextSize,abort,type){
 try{
  const ctx=SillyTavern.getContext();
  const chars=Array.isArray(ctx.characters)?ctx.characters:[];
  const current=chars?.[ctx.characterId], currentName=cname(current);
  if(NARRATOR_NAMES.length&&!NARRATOR_NAMES.some(n=>norm(n)===norm(currentName))){
    setStatus(`当前角色：${currentName||"未知"}\n未启用（仅群像世界主持人）`);
    return;
  }

  const clean=chat.filter(m=>!String(m?.mes??"").startsWith("【NPC角色卡动态加载："));
  const userIndices=clean.map((m,i)=>m?.is_user?i:-1).filter(i=>i>=0);
  const ui=userIndices.at(-1);
  if(ui==null){ setStatus("未找到用户消息",false); return; }

  const userText=String(clean[ui]?.mes??"");
  let prevAi="";
  for(let i=ui-1;i>=0;i--){ if(!clean[i]?.is_user){prevAi=String(clean[i]?.mes??"");break;} }

  const ordered=[];
  const push=r=>{if(r&&!ordered.some(x=>x.target===r.target))ordered.push(r)};
  forced(userText).forEach(push);
  normal(userText).forEach(push);
  if(KEEP_FROM_PREVIOUS_AI)normal(prevAi).forEach(push);

  const loaded=[], missing=[];
  for(const r of ordered.slice(0,MAX_CARDS_PER_TURN)){
    const c=findChar(chars,r.target);
    c?loaded.push(c):missing.push(r.target);
  }

  if(!loaded.length){
    setStatus(missing.length?`识别：${ordered.map(x=>x.target).join("、")}\n未找到卡：${missing.join("、")}`:"本轮未识别到NPC",!missing.length);
    return;
  }

  chat.splice(Math.max(0,chat.length-1),0,{
    is_user:false,name:"NPC Card Loader",send_date:Date.now(),
    mes:loaded.map(build).join("\n\n---\n\n"),
    extra:{npc_card_dynamic_loader:true}
  });

  const msg=`已加载：${loaded.map(cname).join("、")}`+(missing.length?`\n未找到：${missing.join("、")}`:"");
  setStatus(msg,!missing.length);
  console.log(`${TAG} v0.3 ${msg}`);
 }catch(e){
  setStatus(`运行失败：${e?.message||e}`,false);
  console.error(`${TAG} v0.3运行失败`,e);
 }
};

setTimeout(()=>setStatus("扩展已启动，等待生成…"),500);
console.log(`${TAG} v0.3 已加载`);
