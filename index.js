const TAG='[NPC角色卡动态加载器 v0.5]', PID='npc-card-loader-v05';
const RULES=[
 {target:'伊蕾娜',aliases:['伊蕾娜','娜娜']},{target:'公孙雅柔',aliases:['公孙雅柔','公孙雅','公孙柔','雅柔']},
 {target:'露西亚',aliases:['露西亚']},{target:'芙宁娜',aliases:['芙宁娜']},{target:'千夏',aliases:['千夏']},
 {target:'cc',aliases:['cc','CC']},{target:'EZ',aliases:['EZ','Ez','ez']}];
const norm=x=>String(x??'').trim().toLowerCase(), name=c=>c?.name??c?.data?.name??'';
function field(c,...ks){for(const k of ks){for(const o of [c,c?.data]){let v=o?.[k];if(v!=null&&String(v).trim())return String(v).trim();}}return''}
function badge(s,bad=false){
 try{let e=document.getElementById('npc-loader-v05');
 if(!e){e=document.createElement('div');e.id='npc-loader-v05';
 e.style.cssText='position:fixed;top:55px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:90vw;padding:8px 12px;border-radius:9px;background:#151515;color:white;font-size:12px;text-align:center;box-shadow:0 2px 12px #0009;pointer-events:none';(document.body||document.documentElement).appendChild(e)}
 e.textContent='NPC Loader v0.5 · '+s;e.style.border=bad?'1px solid #ff6666':'1px solid #63d98a';e.style.display='block';
 clearTimeout(globalThis.__npcv05);globalThis.__npcv05=setTimeout(()=>e.style.display='none',9000)}catch(x){console.error(TAG,x)}
}
function toast(s,k='info'){try{globalThis.toastr?.[k]?.(s,'NPC Loader v0.5',{timeOut:6000})}catch{}}
function hit(t,a){if(!t)return false;if(/^[A-Za-z0-9_]+$/.test(a)){let q=a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(^|[^A-Za-z0-9_])${q}([^A-Za-z0-9_]|$)`,'i').test(t)}return t.includes(a)}
function detect(t){return RULES.filter(r=>r.aliases.some(a=>hit(t,a)||hit(t,'@'+a)))}
function find(chars,t){let n=norm(t);return chars.find(c=>norm(name(c))===n)||chars.find(c=>norm(name(c)).includes(n))}
function block(c){
 let p=[`【NPC角色卡动态加载：${name(c)}】
以下资料来自该NPC当前导入的原始角色卡，是本轮扮演该NPC时的高优先级人物依据。
保持独立人格、语气、价值判断、关系动态和能力边界；职业/身份不是唯一人格。
近期偶发动作、笑点、照顾方式或口头禅不得自动固化。避免机械重复，根据当前场景自然变化。
用户最新明确设定与已经发生的当前剧情事实优先。`];
 for(const [n,v] of [['Description',field(c,'description')],['Personality',field(c,'personality')],
 ['System Prompt',field(c,'system_prompt','systemPrompt')],['Post History Instructions',field(c,'post_history_instructions','postHistoryInstructions')]])if(v)p.push(`【${n}】\n${v}`);
 return p.join('\n\n')
}
function ctx(){try{return globalThis.SillyTavern?.getContext?.()??null}catch{return null}}
function clear(c){try{c?.setExtensionPrompt?.(PID,'',1,0,false,0)}catch{}}

globalThis.npcCardDynamicLoaderInterceptor=async function(chat,contextSize,abort,type){
 try{
  const c=ctx(); if(!c){badge('拦截器触发，但无法取得 Context',true);toast('无法取得 SillyTavern Context','error');return}
  const chars=Array.isArray(c.characters)?c.characters:[], cur=name(chars?.[c.characterId]);
  if(norm(cur)!==norm('群像世界主持人')){clear(c);badge(`拦截器已触发 · 当前角色：${cur||'未知'} · 未启用`);return}
  let u=''; const ms=Array.isArray(chat)?chat:[];
  // v0.5：只扫描“本轮最新用户消息”。不再读取上一条 AI 回复，
  // 从根源上避免娜娜→露西亚→芙宁娜这种角色卡逐轮累积。
  for(let i=ms.length-1;i>=0;i--){if(ms[i]?.is_user){u=String(ms[i]?.mes??'');break}}
  const rs=[]; for(const r of detect(u))if(!rs.some(x=>x.target===r.target))rs.push(r);
  const loaded=[],missing=[]; for(const r of rs.slice(0,4)){let x=find(chars,r.target);x?loaded.push(x):missing.push(r.target)}
  if(!loaded.length){clear(c);let s=missing.length?`未找到角色卡：${missing.join('、')}`:'本轮未识别到NPC';badge('拦截器已触发 · '+s,!!missing.length);return}
  const inj=loaded.map(block).join('\n\n---\n\n');
  if(typeof c.setExtensionPrompt==='function')c.setExtensionPrompt(PID,inj,1,0,false,0);
  else ms.splice(Math.max(0,ms.length-1),0,{is_user:false,name:'NPC Card Loader',mes:inj,extra:{npc_card_dynamic_loader:true}});
  let s=`已加载：${loaded.map(name).join('、')}`+(missing.length?` · 未找到：${missing.join('、')}`:'');
  badge(s,!!missing.length);toast(s,missing.length?'warning':'success');console.log(TAG,s,{contextSize,type});
 }catch(e){badge('运行失败：'+(e?.message||e),true);toast('运行失败：'+(e?.message||e),'error');console.error(TAG,e)}
};

export async function init(){console.log(TAG,'activate hook called');badge('入口已执行 · 等待生成');toast('扩展入口已执行，等待生成','success')}
console.log(TAG,'module loaded');
setTimeout(()=>{if(!document.getElementById('npc-loader-v05'))badge('模块已加载 · 等待生成')},800);
