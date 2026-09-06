// greenfir 音乐引擎v4 — 完整版（复制粘贴覆盖即可）
const CORS={'content-type':'application/json;charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REF={kw:'https://www.kuwo.cn/',kg:'https://www.kugou.com/',wy:'https://music.163.com/',tx:'https://y.qq.com/',bili:'https://www.bilibili.com/',mg:'https://music.migu.cn/'};
function strip(s){return String(s||'').replace(/<[^>]+>/g,'').trim();}
function rnd(n){let s='';for(let i=0;i<n;i++)s+=Math.floor(Math.random()*10);return s;}

// ===== 第三方聚合源（取链用，多个端点自动回退）=====
const AGGREGATORS = [
  { name:'meting-vercel',  url:id=> `https://api-meting.vercel.app/?type=song&source=netease&id=${id}` },
  { name:'meting-cf',      url:id=> `https://meting-api.vercel.app/?type=song&source=netease&id=${id}` },
  { name:'music-mirror',   url:id=> `https://music-api-muresx.vercel.app/?type=song&source=netease&id=${id}` },
];

function pickUrl(j){
  if(!j) return null;
  if(typeof j==='string' && /^https?:\/\//.test(j)) return j;
  const c=[];
  if(j.url) c.push(j.url);
  if(j.data){
    if(j.data.url) c.push(j.data.url);
    if(Array.isArray(j.data) && j.data[0]) c.push(j.data[0].url);
    if(j.data.song && j.data.song.url) c.push(j.data.song.url);
  }
  if(Array.isArray(j) && j[0]) c.push(j[0].url || j[0].src);
  for(const x of c){ if(x && /^https?:\/\//.test(String(x))) return String(x).replace(/\\/g,''); }
  return null;
}

async function fetchAggUrl(id){
  for(const ag of AGGREGATORS){
    try{
      const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),12000);
      const r=await fetch(ag.url(id),{signal:ctrl.signal,headers:{'User-Agent':UA}});
      clearTimeout(t);
      if(!r.ok) continue;
      const text=await r.text();
      if(/<!doctype|<html/i.test(text)) continue;
      const uu=pickUrl(JSON.parse(text));
      if(uu) return uu;
    }catch(e){}
  }
  return null;
}

// ===== 直连搜索 =====
async function kwSearch(kw,page,size){
  const j=await (await fetch(`https://search.kuwo.cn/r.s?all=${encodeURIComponent(kw)}&ft=music&itemset=web_2013&client=kt&pn=${(page-1)*size}&rn=${size}&rformat=json&encoding=utf8`,{headers:{'User-Agent':UA,'Referer':REF.kw}})).json().catch(()=>null);
  const list=j&&(j.abslist||j.ABLIST||(j.data&&j.data.list))||[];
  return list.map(x=>{const rid=x.MUSICRID||x.musicrid||'';return{id:rid.replace('MUSIC_',''),name:strip(x.SONGNAME||x.name),artist:strip(x.ARTIST||x.artist),album:strip(x.ALBUM||x.album),source:'kw'};}).filter(x=>x.id&&x.name);
}
async function kgSearch(kw,page,size){
  const j=await (await fetch(`http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(kw)}&page=${page}&pagesize=${size}`,{headers:{'User-Agent':UA}})).json().catch(()=>null);
  const list=(j&&j.data&&(j.data.info||j.data.lists))||[];
  return list.map(x=>({id:x.hash||x.FileHash,album_id:x.album_id||x.album_audio_id||'',name:strip(x.songname),artist:strip(x.singername),album:strip(x.album_name),source:'kg'})).filter(x=>x.id&&x.name);
}
async function wySearch(kw,page,size){
  const off=(page-1)*size;
  const j=await (await fetch(`https://music.163.com/api/cloudsearch/pc?s=${encodeURIComponent(kw)}&type=1&offset=${off}&limit=${size}`,{headers:{'User-Agent':UA,'Referer':REF.wy,'Cookie':'appver=2.0.2'}})).json().catch(()=>null);
  const arr=j&&j.result&&j.result.songs||[];
  return arr.map(x=>({id:String(x.id),name:strip(x.name),artist:(x.artists||[]).map(a=>a.name).join('、'),album:x.album?strip(x.album.name):'',source:'wy'})).filter(x=>x.id&&x.name);
}
async function txSearch(kw,page,size){
  const j=await (await fetch(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=${size}&w=${encodeURIComponent(kw)}&format=json`,{headers:{'User-Agent':UA,'Referer':REF.tx}})).json().catch(()=>null);
  const arr=j&&j.data&&j.data.song&&j.data.song.list||[];
  return arr.map(x=>({id:x.songmid||'',name:strip(x.songname),artist:(x.singer||[]).map(s=>s.name).join('、'),album:strip(x.albumname),source:'tx'})).filter(x=>x.id&&x.name);
}
async function biliSearch(kw,page,size){
  try{
    const home=await fetch('https://www.bilibili.com/',{headers:{'User-Agent':UA}});
    const m=(home.headers.get('set-cookie')||'').match(/buvid3=([^;]+)/);
    const cookie=m?`buvid3=${m[1]}`:'';
    const j=await (await fetch(`https://api.bilibili.com/x/web-interface/search/type?search_type=audio&keyword=${encodeURIComponent(kw)}&page=${page}`,{headers:{'User-Agent':UA,'Referer':REF.bili,'Cookie':cookie}})).json().catch(()=>null);
    const arr=j&&j.data&&j.data.result||[];
    return arr.slice(0,size).map(x=>({id:String(x.id),name:strip(x.title),artist:strip(x.author),source:'bili'})).filter(x=>x.id&&x.name);
  }catch(e){return [];}
}
async function mgSearch(){return [];}

const SEARCH={kw:kwSearch,kg:kgSearch,wy:wySearch,tx:txSearch,bili:biliSearch,mg:mgSearch};
const LEVELS={kw:['standard','exhigh','lossless'],kg:['standard','exhigh','lossless'],wy:['standard','exhigh','lossless'],tx:['standard','exhigh','lossless'],bili:['bili192'],mg:['standard']};

// ===== 直连取链（回退用）=====
async function kwUrl(id,level){
  const br={standard:'128kmp3',exhigh:'192kmp3',lossless:'320kmp3'}[level]||'128kmp3';
  for(const u of [
    `https://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_${id}&format=mp3&response=url&br=${br}`,
    `https://www.kuwo.cn/api/v1/www/music/playUrl?mid=${id}&type=convert_url3&br=${br}`
  ]){try{const txt=await (await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.kw}})).text();if(/^https?:\/\//.test(txt.trim()))return txt.trim();}catch(e){}}
  return null;
}
async function kgUrl(id,level,albumId){
  const dfid='0THXdR3FLc9C0ag4Tx1Pg6XO';const mid=rnd(32);
  const urls=[albumId?`https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${id}&album_id=${albumId}&dfid=${dfid}&mid=${mid}&platid=4&appid=1014`:null,
    `https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${id}&dfid=${dfid}&mid=${mid}&platid=4&appid=1014`,
    `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${id}`].filter(Boolean);
  for(const u of urls){try{const j=await (await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.kg}})).json().catch(()=>null);const d=j&&(j.data||j)||{};if(d.play_url||d.url)return String(d.play_url||d.url).replace(/\\/g,'');}catch(e){}}
  return null;
}
async function wyUrl(id){
  for(const u of [
    `https://music.163.com/api/song/enhance/player/url?id=${id}&ids=%5B${id}%5D&br=128000`,
    `https://music.163.com/song/media/outer/url?id=${id}.mp3`
  ]){try{
    if(u.includes('outer/url')){const rr=await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.wy}});if(rr.url&&/\.(mp3|m4a)/.test(rr.url))return rr.url;continue;}
    const j=await (await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.wy}})).json().catch(()=>null);
    if(j&&j.data&&j.data[0]&&j.data[0].url)return j.data[0].url;
  }catch(e){}}
  return null;
}
async function txUrl(id,level){
  const guid=rnd(10);const fn=level==='lossless'?'M800':'M500';
  for(const u of [
    `https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?format=json205361747&platform=yqq&cid=205361747&songmid=${id}&filename=${fn}${id}.mp3&guid=${guid}`,
    `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify({req_0:{module:'vkey.GetVkeyServer',method:'CgiGetVkey',param:{guid,songmid:[id],songtype:[0],uin:'0',loginflag:1,platform:'20'}}}))}`
  ]){try{const j=await (await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.tx}})).json().catch(()=>null);
    let v=j&&j.data&&j.data.items&&j.data.items[0]&&j.data.items[0].vkey;
    if(!v&&j&&j.req_0&&j.req_0.data&&j.req_0.data.midurlinfo&&j.req_0.data.midurlinfo[0]){const it=j.req_0.data.midurlinfo[0];if(it.purl)return `https://isure.stream.qqmusic.qq.com/${it.purl}`;v=it.vkey;}
    if(v&&v.length>10)return `https://isure.stream.qqmusic.qq.com/${fn}${id}.mp3?vkey=${v}&guid=${guid}&uin=0&fromtag=66`;
  }catch(e){}}
  return null;
}
async function biliUrl(id){
  try{const j=await (await fetch(`https://www.bilibili.com/audio/music-service-c/web/url?sid=${id}`,{headers:{'User-Agent':UA,'Referer':REF.bili}})).json().catch(()=>null);if(j&&j.data&&j.data.cdns&&j.data.cdns[0])return j.data.cdns[0];}catch(e){}
  return null;
}
const DIRECT={kw:id=>kwUrl(id,'standard'),kg:(id,al)=>kgUrl(id,'standard',al),wy:id=>wyUrl(id),tx:id=>txUrl(id,'standard'),bili:id=>biliUrl(id),mg:()=>null};

// ===== 路由 =====
async function handleSearch(url){
  const kw=url.searchParams.get('keyword')||'';
  const src=url.searchParams.get('source')||'kw';
  const page=parseInt(url.searchParams.get('page')||'1');
  const size=parseInt(url.searchParams.get('size')||'20');
  if(!kw)return json({ok:false,msg:'缺少关键词'});
  try{
    const list=await SEARCH[src](kw,page,size);
    if(!list.length)return json({ok:true,source:src,list:[],msg:'该源未返回结果'});
    return json({ok:true,source:src,list});
  }catch(e){return json({ok:false,msg:'搜索失败: '+e.message});}
}

async function handleUrl(url){
  const id=url.searchParams.get('id');
  const src=url.searchParams.get('source')||'kw';
  const albumId=url.searchParams.get('album_id')||'';
  const wantLv=url.searchParams.get('level')||'';
  if(!id)return json({ok:false,msg:'缺少id'});
  const lv=wantLv||(LEVELS[src]&&LEVELS[src][0])||'standard';
  let u=await fetchAggUrl(id);                 // ① 聚合源
  if(u)return json({ok:true,url:u,level:lv,source:src,via:'aggregator'});
  try{ u = await DIRECT[src](id,albumId); }catch(e){}  // ② 直连回退
  if(u)return json({ok:true,url:u,level:lv,source:src,via:'direct'});
  return json({ok:false,msg:'聚合源与直连均取链失败。点「自检」查看，或检查 AGGREGATORS 是否可用'});
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

async function handleConfig(cfgUrl){
  const remote=cfgUrl||'https://13413.kstore.vip/QingMusic/ceshi.json';
  try{
    const r=await fetch(remote,{headers:{'User-Agent':UA}});
    const j=await r.json();
    return json({ok:true,lines:(j.lines||[]).filter(l=>l.enabled!==false)});
  }catch(e){return json({ok:false,msg:'读取音源配置失败，使用内置默认',lines:[]});}
}

async function handleTest(url){
  const kw=url.searchParams.get('keyword')||'起风了';
  const out=[];
  for(const ag of AGGREGATORS){   // 1) 聚合源
    let ok=false,note='';
    try{
      const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),10000);
      const r=await fetch(ag.url('1813729125'),{signal:ctrl.signal,headers:{'User-Agent':UA}});
      clearTimeout(t);
      const text=await r.text();
      if(!/<!doctype|<html/i.test(text)){const j=JSON.parse(text);const uu=pickUrl(j);if(uu){ok=true;note=String(uu).slice(0,70);}else note='JSON无url字段';}
      else note='返回HTML(不可用)';
    }catch(e){note=e.message;}
    out.push({item:'聚合源·'+ag.name, search:ok, url:ok, note});
  }
  for(const key of Object.keys(SEARCH)){  // 2) 各源搜索+取链
    const rec={source:key,search:false,url:false,note:''};
    try{
      const list=await SEARCH[key](kw,1,3);
      rec.search=list.length>0;rec.count=list.length;
      if(rec.search){
        const u=await fetchAggUrl(list[0].id);
        rec.url=!!u;rec.note=u?String(u).slice(0,70):'聚合取链失败';
        if(!u){const du=await DIRECT[key](list[0].id,list[0].album_id||'');rec.url=!!du;rec.note=du?('直连可: '+String(du).slice(0,50)):'聚合/直连均失败';}
      }
    }catch(e){rec.note=e.message;}
    out.push(rec);
  }
  return json({ok:true,results:out});
}

export async function onRequestGet({request}){
  const url=new URL(request.url);
  const action=url.searchParams.get('action');
  if(action==='search')return handleSearch(url);
  if(action==='url')return handleUrl(url);
  if(action==='proxy')return handleProxy(url,request);
  if(action==='config')return handleConfig(url.searchParams.get('cfg'));
  if(action==='test')return handleTest(url);
  return json({ok:false,msg:'未知 action。可用: search / url / proxy / config / test'});
}
