// greenfir 音乐核心 —— 两代合一
//   core=v1 : 一代 · 签名版（请求自建 Worker 走完整 HMAC-SHA1）
//   core=v2 : 二代 · 无签名（请求自建 Worker 只带 ?token=，最简单）
// 通过 URL 参数 core=v1/v2 切换，前端 music.html 的下拉框就是控制这个。
const CORS={'content-type':'application/json;charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REF={kw:'https://www.kuwo.cn/',kg:'https://www.kugou.com/',wy:'https://music.163.com/',tx:'https://y.qq.com/',bili:'https://www.bilibili.com/',bd:'https://music.taihe.com/'};
function strip(s){return String(s||'').replace(/<[^>]+>/g,'').trim();}
function rnd(n){let s='';for(let i=0;i<n;i++)s+=Math.floor(Math.random()*10);return s;}

// ============================================================
//  ★ 配置区（只改这里）★
// ============================================================
const CONF={
  WORKER:'https://music-service.greenfir.dpdns.org', // ★ 你的 Worker 自定义域名
  WORKER_TOKEN:'greenfir2026',                        // ★ 与 Worker 端 TOKEN 一致
  SIGN_TTL:300,                                       // 签名时效(秒)，与 Worker 端一致
};
// ============================================================

// ---------- 通用工具 ----------
function b64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)));}
async function hmacSha1(secret,msg){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(msg));
  return b64(sig);
}
// 生成 HMAC 签名请求头（一代用）
async function signedHeaders(method,pathname,body){
  const ts=String(Math.floor(Date.now()/1000));
  const payload=`${method.toUpperCase()}${pathname}${body||''}${ts}`;
  const sign=await hmacSha1(CONF.WORKER_TOKEN,payload);
  return {'User-Agent':UA,'X-Token':CONF.WORKER_TOKEN,'X-Timestamp':ts,'X-Sign':sign};
}
function withToken(url){
  if(!CONF.WORKER_TOKEN)return url;
  return url+(url.includes('?')?'&':'?')+`token=${encodeURIComponent(CONF.WORKER_TOKEN)}`;
}
function parseJSON(text){
  if(!text)return null;let t=text.trim();
  try{return JSON.parse(t);}catch(e){}
  let m=t.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
  if(m){try{return JSON.parse(m[1]);}catch(e){}}
  const i=t.indexOf('{'),j=t.lastIndexOf('}');
  if(i>=0&&j>i){try{return JSON.parse(t.slice(i,j+1));}catch(e){}}
  return null;
}
async function getJSON(url,headers){
  try{const r=await fetch(url,{headers:Object.assign({'User-Agent':UA},headers||{})});if(!r.ok)return null;return parseJSON(await r.text());}catch(e){return null;}
}
function pickUrl(j){
  if(!j)return null;
  if(typeof j==='string'&&/^https?:\/\//.test(j))return j;
  const c=[];
  if(j.url)c.push(j.url);
  if(j.data){if(j.data.url)c.push(j.data.url);if(Array.isArray(j.data)&&j.data[0])c.push(j.data[0].url);if(j.data.song&&j.data.song.url)c.push(j.data.song.url);}
  if(Array.isArray(j)&&j[0])c.push(j[0].url||j[0].src);
  return c.find(x=>x&&/^https?:\/\//.test(String(x)))||null;
}

// ============================================================
//  两代核心的"唯一差异点"：怎么请求自建 Worker
// ============================================================
// 一代(v1)：HMAC 签名
async function callWorkerV1(pathname,query){
  const url=`${CONF.WORKER}${pathname}?${query}`;
  const headers=await signedHeaders('GET',pathname,query);
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),12000);
  return fetch(url,{signal:ctrl.signal,headers}).then(r=>{clearTimeout(t);return r;});
}
// 二代(v2)：无签名，只带 token 参数（最简单，兼容只校验 ?token= 的 Worker）
async function callWorkerV2(pathname,query){
  const url=withToken(`${CONF.WORKER}${pathname}?${query}`);
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),12000);
  return fetch(url,{signal:ctrl.signal,headers:{'User-Agent':UA}}).then(r=>{clearTimeout(t);return r;});
}
// 按 core 参数分发
async function callWorker(core,pathname,query){
  return core==='v1'?callWorkerV1(pathname,query):callWorkerV2(pathname,query);
}

// ============================================================
//  聚合层（自建 Worker 为主 + 公共镜像兜底）
// ============================================================
const PROVIDERS=[
  {id:'self', name:'自建核心 (music-service)', enabled:true},
  {id:'mirror1', name:'公共镜像A (api-meting)', enabled:true},
  {id:'mirror2', name:'公共镜像B', enabled:false},
];
const SERVER_MAP={wy:'netease',tx:'tencent',kg:'kugou',kw:'kuwo',bd:'baidu',bili:'bilibili'};
function toServer(frontSrc){return SERVER_MAP[frontSrc]||frontSrc;}

async function fetchAggregator(core,id,frontSrc){
  const server=toServer(frontSrc);
  for(const p of PROVIDERS){if(!p.enabled)continue;
    try{
      let r;
      if(p.id==='self'){
        r=await callWorker(core,'/api',`server=${server}&type=song&id=${encodeURIComponent(id)}`);
      }else{
        const u=p.id==='mirror1'
          ?`https://api-meting.vercel.app/?server=${server}&type=song&id=${encodeURIComponent(id)}`
          :`https://meting-api.vercel.app/?server=${server}&type=song&id=${encodeURIComponent(id)}`;
        const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),12000);
        r=await fetch(u,{signal:ctrl.signal,headers:{'User-Agent':UA}});clearTimeout(t);
      }
      if(!r.ok)continue;
      const text=await r.text();
      if(/<!doctype|<html/i.test(text))continue;
      const uu=pickUrl(parseJSON(text));
      if(uu)return {url:uu,via:`${p.id}-${core}`};
    }catch(e){}
  }
  return null;
}

// ============================================================
//  直连层（各平台官方接口，聚合全挂时兜底）
// ============================================================
async function directUrl(frontSrc,id,lv,albumId){
  const s=toServer(frontSrc);
  switch(s){
    case 'kuwo':{const br={standard:'128kmp3',exhigh:'192kmp3',lossless:'320kmp3'}[lv]||'128kmp3';
      for(const u of [
        `https://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_${id}&format=mp3&response=url&br=${br}`,
        `https://www.kuwo.cn/api/v1/www/music/playUrl?mid=${id}&type=convert_url3&br=${br}`
      ]){const txt=await (await fetch(u,{'User-Agent':UA,'Referer':REF.kw}).catch(()=>null))?.text();if(txt&&/^https?:\/\//.test(txt.trim()))return txt.trim();}
      return null;}
    case 'kugou':{const dfid='0THXdR3FLc9C0ag4Tx1Pg6XO',mid=rnd(32);
      for(const u of [
        albumId?`https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${id}&album_id=${albumId}&dfid=${dfid}&mid=${mid}&platid=4&appid=1014`:null,
        `https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${id}&dfid=${dfid}&mid=${mid}&platid=4&appid=1014`,
        `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${id}`
      ].filter(Boolean)){const j=await getJSON(u,{'Referer':REF.kg});const d=j&&(j.data||j)||{};if(d.play_url||d.url)return String(d.play_url||d.url).replace(/\\/g,'');}
      return null;}
    case 'netease':{const j=await getJSON(`https://music.163.com/api/song/enhance/player/url?id=${id}&ids=%5B${id}%5D&br=128000`,{'Referer':REF.wy,'Cookie':'appver=2.0.2'});
      if(j&&j.data&&j.data[0]&&j.data[0].url)return j.data[0].url;
      const r2=await fetch(`https://music.163.com/song/media/outer/url?id=${id}.mp3`,{'User-Agent':UA,'Referer':REF.wy});
      if(r2.url&&/\.(mp3|m4a)/.test(r2.url))return r2.url;return null;}
    case 'tencent':{const guid=rnd(10);
      const j=await getJSON(`https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?format=json205361747&platform=yqq&cid=205361747&songmid=${id}&filename=M500${id}.mp3&guid=${guid}`,{'Referer':REF.tx});
      let v=j&&j.data&&j.data.items&&j.data.items[0]&&j.data.items[0].vkey;
      if(v&&v.length>10)return `https://isure.stream.qqmusic.qq.com/M500${id}.mp3?vkey=${v}&guid=${guid}&uin=0&fromtag=66`;
      const ju=await getJSON(`https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify({req_0:{module:'vkey.GetVkeyServer',method:'CgiGetVkey',param:{guid,songmid:[id],songtype:[0],uin:'0',loginflag:1,platform:'20'}}}))}`,{'Referer':REF.tx});
      if(ju&&ju.req_0&&ju.req_0.data&&ju.req_0.data.midurlinfo&&ju.req_0.data.midurlinfo[0]){const it=ju.req_0.data.midurlinfo[0];if(it.purl)return `https://isure.stream.qqmusic.qq.com/${it.purl}`;}
      return null;}
    case 'baidu':{const j=await getJSON(`https://musicapi.taihe.com/v1/song/info?songIds=${id}`,{'Referer':REF.bd});
      const list=(j&&j.data&&j.data.songList)||(j&&j.songList)||[];
      const song=list.find(x=>String(x.songId||x.id)===String(id))||list[0];
      return song&&(song.songLink||(song.htsSongIndex&&song.htsSongIndex.fileSize))||null;}
    default:return null;
  }
}

async function search(src,kw,page,size){
  switch(toServer(src)){
    case 'kuwo':{const j=await getJSON(`https://search.kuwo.cn/r.s?all=${encodeURIComponent(kw)}&ft=music&itemset=web_2013&client=kt&pn=${(page-1)*size}&rn=${size}&rformat=json&encoding=utf8`,{'Referer':REF.kw});
      const list=j&&(j.abslist||j.ABLIST||(j.data&&j.data.list))||[];
      return list.map(x=>{const rid=x.MUSICRID||x.musicrid||'';return{id:rid.replace('MUSIC_',''),name:strip(x.SONGNAME||x.name),artist:strip(x.ARTIST||x.artist),album:strip(x.ALBUM||x.album),source:src};});}
    case 'kugou':{const j=await getJSON(`http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(kw)}&page=${page}&pagesize=${size}`,{});
      const list=(j&&j.data&&(j.data.info||j.data.lists))||[];
      return list.map(x=>({id:x.hash||x.FileHash,album_id:x.album_id||x.album_audio_id||'',name:strip(x.songname),artist:strip(x.singername),album:strip(x.album_name),source:src}));}
    case 'netease':{const off=(page-1)*size;
      const j=await getJSON(`https://music.163.com/api/cloudsearch/pc?s=${encodeURIComponent(kw)}&type=1&offset=${off}&limit=${size}`,{'Referer':REF.wy,'Cookie':'appver=2.0.2'});
      const arr=j&&j.result&&j.result.songs||[];
      return arr.map(x=>({id:String(x.id),name:strip(x.name),artist:(x.artists||[]).map(a=>a.name).join('、'),album:x.album?strip(x.album.name):'',source:src}));}
    case 'tencent':{const j=await getJSON(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=${size}&w=${encodeURIComponent(kw)}&format=json`,{'Referer':REF.tx});
      const arr=j&&j.data&&j.data.song&&j.data.song.list||[];
      return arr.map(x=>({id:x.songmid||'',name:strip(x.songname),artist:(x.singer||[]).map(s=>s.name).join('、'),album:strip(x.albumname),source:src}));}
    case 'baidu':{const j=await getJSON(`https://musicapi.taihe.com/v1/search?query=${encodeURIComponent(kw)}&page_no=${page}&page_size=${size}&type=1`,{'Referer':REF.bd});
      const arr=(j&&j.data&&j.data.typeTrack&&j.data.typeTrack.list)||(j&&j.result&&j.result.songs)||[];
      return arr.map(x=>({id:String(x.songId||x.id),name:strip(x.title||x.name),artist:strip((x.author||x.artist||[]).map?.(a=>a.name||a)||(x.artist||'')),album:strip(x.album||x.albumname||''),source:src}));}
    default:return [];
  }
}

const LEVELS={kw:['standard','exhigh','lossless'],kg:['standard','exhigh','lossless'],wy:['standard','exhigh','lossless'],tx:['standard','exhigh','lossless'],bili:['bili192'],bd:['standard']};

// ============================================================
//  路由
// ============================================================
function pickCore(url){return url.searchParams.get('core')==='v1'?'v1':'v2';}

async function handleSearch(url){
  const kw=url.searchParams.get('keyword')||'';
  const src=url.searchParams.get('source')||'kw';
  const page=parseInt(url.searchParams.get('page')||'1');
  const size=parseInt(url.searchParams.get('size')||'20');
  if(!kw)return json({ok:false,msg:'缺少关键词'});
  try{const list=await search(src,kw,page,size);if(!list.length)return json({ok:true,source:src,list:[],msg:'该源未返回结果'});return json({ok:true,source:src,list});}
  catch(e){return json({ok:false,msg:'搜索失败: '+e.message});}
}

async function handleUrl(url){
  const core=pickCore(url);
  const id=url.searchParams.get('id');
  const src=url.searchParams.get('source')||'kw';
  const albumId=url.searchParams.get('album_id')||'';
  const lv=url.searchParams.get('level')||(LEVELS[src]&&LEVELS[src][0])||'standard';
  if(!id)return json({ok:false,msg:'缺少id'});
  const agg=await fetchAggregator(core,id,src);
  if(agg)return json({ok:true,url:agg.url,level:lv,source:src,via:agg.via,core});
  const direct=await directUrl(src,id,lv,albumId);
  if(direct)return json({ok:true,url:direct,level:lv,source:src,via:`direct-${toServer(src)}-${core}`,core});
  return json({ok:false,msg:`[${core}] 聚合层与直连层均未能取链。可在界面切换另一代核心再试。`});
}

async function handleProxy(url,req){
  const target=url.searchParams.get('url');
  const src=url.searchParams.get('source')||'kw';
  if(!target)return json({ok:false,msg:'缺少url'});
  const h={'User-Agent':UA,'Referer':REF[src]||''};
  const range=req.headers.get('range');if(range)h['Range']=range;
  const up=await fetch(target,{headers:h});
  const rh=new Headers();
  rh.set('access-control-allow-origin','*');rh.set('accept-ranges','bytes');
  const ct=up.headers.get('content-type');if(ct)rh.set('content-type',ct);
  const cr=up.headers.get('content-range');if(cr)rh.set('content-range',cr);
  const cl=up.headers.get('content-length');if(cl)rh.set('content-length',cl);
  return new Response(up.body,{status:up.status,headers:rh});
}

// 签名自检（一代专属，二代会直接提示"未启用签名"）
async function handleVerify(){
  const ts=String(Math.floor(Date.now()/1000));
  const pathname='/api';const query='action=verify';
  const headers=await signedHeaders('GET',pathname,query);
  try{
    const r=await fetch(`${CONF.WORKER}${pathname}?${query}`,{headers});
    const text=await r.text();
    let j=null;try{j=JSON.parse(text);}catch(e){}
    return json({ok:!!(j&&j.ok),core:'v1',msg:(j&&j.msg)||(r.ok?'请求成功但返回非JSON':'Worker 未识别 verify'),expect:'HMAC-SHA1',workerResponse:j||text.slice(0,200)});
  }catch(e){return json({ok:false,core:'v1',msg:'调用 Worker 失败: '+e.message});}
}

async function handleTest(url){
  const core=pickCore(url);
  const kw=url.searchParams.get('keyword')||'起风了';
  const out={aggregators:[],sources:[],core,via:`使用核心: ${core==='v1'?'一代(签名)':'二代(无签名)'}`};
  // 聚合层
  for(const p of PROVIDERS){if(!p.enabled)continue;
    let ok=false,note='';
    try{
      if(p.id==='self'){
        const r=await callWorker(core,'/api',`server=netease&type=song&id=1813729125`);
        const text=await r.text();
        if(!/<!doctype|<html/i.test(text)){const j=parseJSON(text);const uu=pickUrl(j);if(uu){ok=true;note=String(uu).slice(0,60);}else note='返回无url字段';}
        else note='返回HTML(服务不可用/鉴权拦截)';
      }else{note='镜像(本次未测)';}
    }catch(e){note=e.message;}
    out.aggregators.push({name:`${p.name} [${core}]`,ok,note});
  }
  // 直连层
  for(const src of ['kw','kg','wy','tx','bd']){
    const rec={name:src,search:false,url:false,note:''};
    try{
      const list=await search(src,kw,1,3);
      rec.search=list.length>0;rec.count=list.length;
      if(rec.search){const u=await directUrl(src,list[0].id,LEVELS[src]&&LEVELS[src][0],list[0].album_id||'');rec.url=!!u;rec.note=u?String(u).slice(0,60):'取链失败(风控)';}
    }catch(e){rec.note=e.message;}
    out.sources.push(rec);
  }
  out.tip = core==='v1'
    ? '一代=完整 HMAC 签名。若聚合层 ❌，先跑 action=verify 确认签名规则与 Worker 一致。'
    : '二代=仅带 ?token= 参数，不签名。若此代能用而一代不能用，说明 Worker 校验的是简单 token 而非 HMAC。';
  return json({ok:true,...out});
}

export async function onRequestGet({request}){
  const url=new URL(request.url);
  const action=url.searchParams.get('action');
  if(action==='search')return handleSearch(url);
  if(action==='url')return handleUrl(url);
  if(action==='proxy')return handleProxy(url,request);
  if(action==='verify')return handleVerify();
  if(action==='test')return handleTest(url);
  return json({ok:false,msg:'未知 action。可用: search / url / proxy / verify / test'});
}
