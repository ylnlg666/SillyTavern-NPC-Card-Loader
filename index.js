const TAG="[NPC角色卡动态加载器]";
const NPC_RULES=[
 {target:"伊蕾娜",aliases:["伊蕾娜","娜娜"]},
 {target:"公孙雅柔",aliases:["公孙雅柔","公孙雅","公孙柔","雅柔"]},
 {target:"露西亚",aliases:["露西亚"]},
 {target:"芙宁娜",aliases:["芙宁娜"]},
 {target:"千夏",aliases:["千夏"]},
 {target:"cc",aliases:["cc","CC"]},
 {target:"EZ",aliases:["EZ","Ez","ez"]}
];
const SCAN_LAST_MESSAGES=6, MAX_CARDS_PER_TURN=4;
const INCLUDE_EXAMPLE_MESSAGES=false;
const NARRATOR_NAMES=["群像世界主持人"];
const norm=v=>String(v??"").trim().toLowerCase();
const cname=c=>c?.name??c?.data?.name??"";
function findChar(chars,target){
 const t=norm(target);
 return chars.find(c=>norm(cname(c))===t) || chars.find(c=>norm(cname(c)).includes(t));
}
function field(c,...ks){
 for(const k of ks){
  if(c?.[k]!=null&&String(c[k]).trim()) return String(c[k]).trim();
  if(c?.data?.[k]!=null&&String(c.data[k]).trim()) return String(c.data[k]).trim();
 }
 return "";
}
function cardPrompt(c){
 const p=[`【NPC角色卡动态加载：${cname(c)}】`,
 "以下资料来自该NPC的原始角色卡。群像主持人应据此扮演该NPC；职业不是唯一人格，最近一次偶发行为不得自动固化为习惯。"];
 const add=(n,v)=>{if(v)p.push(`【${n}】\n${v}`)};
 add("Description",field(c,"description"));
 add("Personality",field(c,"personality"));
 add("Scenario",field(c,"scenario"));
 add("System Prompt",field(c,"system_prompt","systemPrompt"));
 add("Post History Instructions",field(c,"post_history_instructions","postHistoryInstructions"));
 if(INCLUDE_EXAMPLE_MESSAGES)add("Example Messages",field(c,"mes_example","mesExample"));
 return p.join("\n\n");
}
globalThis.npcCardDynamicLoaderInterceptor=async function(chat,contextSize,abort,type){
 try{
  const ctx=SillyTavern.getContext(), chars=Array.isArray(ctx.characters)?ctx.characters:[];
  const current=chars?.[ctx.characterId], currentName=cname(current);
  if(NARRATOR_NAMES.length&&!NARRATOR_NAMES.some(n=>norm(n)===norm(currentName)))return;
  const recent=chat.filter(m=>!String(m?.mes??"").startsWith("【NPC角色卡动态加载：")).slice(-SCAN_LAST_MESSAGES);
  const txt=recent.map(m=>String(m?.mes??"")).join("\n");
  const hit=[];
  for(const r of NPC_RULES){
   if(r.aliases.some(a=>txt.includes(a))){
    const c=findChar(chars,r.target);
    if(c&&!hit.includes(c))hit.push(c);
   }
   if(hit.length>=MAX_CARDS_PER_TURN)break;
  }
  if(!hit.length)return;
  const note={is_user:false,name:"NPC Card Loader",send_date:Date.now(),
   mes:hit.map(cardPrompt).join("\n\n---\n\n"),extra:{npc_card_dynamic_loader:true}};
  chat.splice(Math.max(0,chat.length-1),0,note);
  console.log(`${TAG} 本轮加载：${hit.map(cname).join(", ")}`);
 }catch(e){console.error(`${TAG} 运行失败`,e)}
};
console.log(`${TAG} 已加载`);
