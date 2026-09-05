// 青听风格音乐引擎 — Cloudflare Pages Function
// action=search(搜索) | url(取直链) | proxy(音频代理) | config(读音源配置)
const CORS={'content-type':'application/json;charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const REF={kw:'https://www.kuwo.cn/',kg:'https://www.kugou.com/',wy:'https://music.163.com/',tx:'https://y.qq.com/',bili:'https://www.bilibili.com/',mg:'https://music.migu.cn/'};
function strip(s){return String(s||'').replace(/<[^>]+>/g,'').trim();}

/* ---------- 酷我 kw ---------- */
function kwBr(l){const m={standard:'128kmp3',exhigh:'192kmp3',lossless:'320kmp3',atmos:'320kmp3',atmos_plus:'320kmp3',master:'320kmp3'};return m[l]||'320kmp3';}
async function kwSearch(kw,page,size){
  const u=`https://search.kuwo.cn/r.s?all=${encodeURIComponent(kw)}&ft=music&itemset=web_2013&client=kt&pn=${(page-1)*size}&rn=${size}&rformat=json&encoding=utf8`;
  const r=await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.kw}});
  const j=await r.json();
  const list=j.abslist||j.ABLIST||(j.data&&j.data.list)||[];
  return list.map(x=>{const rid=x.MUSICRID||x.musicrid||'';return{id:rid.replace('MUSIC_',''),name:strip(x.SONGNAME||x.songname||x.name),artist:strip(x.ARTIST||x.artist),album:strip(x.ALBUM||x.album),source:'kw'};}).filter(x=>x.id&&x.name);
}
async function kwUrl(id,level){
  try{
    const r=await fetch(`http://www.kuwo.cn/api/v1/www/music/playUrl?mid=${id}&type=convert_url3&br=${kwBr(level)}`,{headers:{'User-Agent':UA,'Referer':REF.kw}});
    const j=await r.json();
    if(j&&j.data&&j.data.url)return j.data.url;
  }catch(e){}
  try{
    const r2=await fetch(`http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_${id}&format=mp3&response=url`,{headers:{'User-Agent':UA,'Referer':REF.kw}});
    const t=await r2.text();
    if(t&&t.trim().startsWith('http'))return t.trim();
  }catch(e){}
  return null;
}

/* ---------- 酷狗 kg ---------- */
async function kgSearch(kw,page,size){
  const u=`http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(kw)}&page=${page}&pagesize=${size}`;
  const r=await fetch(u,{headers:{'User-Agent':UA}});
  const j=await r.json();
  const list=(j.data&&j.data.info)||[];
  return list.map(x=>({id:x.hash,album_id:x.album_id||x.album_audio_id||'',name:strip(x.songname),artist:strip(x.singername),album:strip(x.album_name),duration:x.duration||0,source:'kg'})).filter(x=>x.id&&x.name);
}
async function kgUrl(id,level,albumId){
  let u=`https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${id}&mid=1&platid=4`;
  if(albumId)u+=`&album_id=${albumId}`;
  try{
    const r=await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.kg}});
    let t=await r.text();
    if(/^\s*jQuery/.test(t)){const m=t.match(/\(([\s\S]*)\)\s*$/);if(m)t=m[1];}
    const j=JSON.parse(t);
    if(j.data&&j.data.play_url)return String(j.data.play_url).replace(/\\/g,'');
    if(j.play_url)return String(j.play_url).replace(/\\/g,'');
  }catch(e){}
  return null;
}

/* ---------- 网易云 wy ---------- */
async function wySearch(kw,page,size){
  const u=`https://music.163.com/api/search/get/web?csrf_token=hlpretag=&hlposttag=&s=${encodeURIComponent(kw)}&type=1&offset=${(page-1)*size}&total=true&limit=${size}`;
  const r=await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.wy,'Cookie':'appver=2.0.2'}});
  const j=await r.json();
  const arr=(j.result&&j.result.songs)||[];
  return arr.map(x=>({id:String(x.id),name:strip(x.name),artist:(x.artists||[]).map(a=>a.name).join('、'),album:x.album?strip(x.album.name):'',cover:x.album&&x.album.picUrl?x.album.picUrl:'',source:'wy'})).filter(x=>x.id&&x.name);
}
async function wyUrl(id){
  try{
    const r=await fetch(`https://music.163.com/song/media/outer/url?id=${id}.mp3`,{headers:{'User-Agent':UA,'Referer':REF.wy},redirect:'follow'});
    if(r.url&&/\.mp3/.test(r.url))return r.url;
  }catch(e){}
  return null;
}

/* ---------- QQ tx ---------- */
async function txSearch(kw,page,size){
  const u=`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=${size}&w=${encodeURIComponent(kw)}&format=json`;
  const r=await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.tx}});
  const j=await r.json();
  const arr=(j.data&&j.data.song&&j.data.song.list)||[];
  return arr.map(x=>({id:x.songmid||x.mid||'',name:strip(x.songname),artist:(x.singer||[]).map(s=>s.name).join('、'),album:strip(x.albumname),source:'tx'})).filter(x=>x.id&&x.name);
}
async function txUrl(id){
  try{
    const r=await fetch(`https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?format=json&cid=205361747&songmid=${id}&filename=C400${id}.m4a&guid=126548448`,{headers:{'User-Agent':UA,'Referer':REF.tx}});
    const j=await r.json();
    const v=j.data&&j.data.items&&j.data.items[0]&&j.data.items[0].vkey;
    if(!v)return null;
    return `https://isure.stream.qqmusic.qq.com/C400${id}.m4a?vkey=${v}&guid=126548448&uin=0&fromtag=66`;
  }catch(e){return null;}
}

/* ---------- B站 bili ---------- */
async function biliSearch(kw,page,size){
  const u=`https://api.bilibili.com/x/web-interface/search/type?search_type=audio&keyword=${encodeURIComponent(kw)}&page=${page}`;
  const r=await fetch(u,{headers:{'User-Agent':UA,'Referer':REF.bili}});
  const j=await r.json();
  const arr=(j.data&&j.data.result)||[];
  return arr.slice(0,size).map(x=>({id:String(x.id),name:strip(x.title),artist:strip(x.author),cover:x.cover?('https:'+x.cover):'',source:'bili'})).filter(x=>x.id&&x.name);
}
async function biliUrl(id){
  try{
    const r=await fetch(`https://www.bilibili.com/audio/music-service-c/web/url?sid=${id}`,{headers:{'User-Agent':UA,'Referer':REF.bili}});
    const j=await r.json();
    if(j.data&&j.data.cdns&&j.data.cdns.length)return j.data.cdns[0];
  }catch(e){}
  return null;
}

/* ---------- 咪咕 mg（需签名，暂返回空） ---------- */
async function mgSearch(){return [];}
async function mgUrl(){return null;}

const ENGINES={kw:{search:kwSearch,url:kwUrl},kg:{search:kgSearch,url:kgUrl},wy:{search:wySearch,url:wyUrl},tx:{search:txSearch,url:txUrl},bili:{search:biliSearch,url:biliUrl},mg:{search:mgSearch,url:mgUrl}};

/* ---------- 音质候选（按 ceshi.json 的 levels 顺序回退） ---------- */
const LEVELS={kw:['lossless','exhigh','standard'],kg:['lossless','exhigh','standard'],wy:['lossless','exhigh','standard'],tx:['lossless','exhigh','standard'],bili:['bili192'],mg:['standard']};

async function handleSearch(url){
  const kw=url.searchParams.get('keyword')||'';
  const src=url.searchParams.get('source')||'kw';
  const page=parseInt(url.searchParams.get('page')||'1');
  const size=parseInt(url.searchParams.get('size')||'20');
  if(!kw)return json({ok:false,msg:'缺少关键词'});
  const eng=ENGINES[src];
  if(!eng)return json({ok:false,msg:'未知音源 '+src});
  try{
    const list=await eng.search(kw,page,size);
    return json({ok:true,source:src,list});
  }catch(e){return json({ok:false,msg:'搜索失败: '+e.message});}
}

async function handleUrl(url){
  const id=url.searchParams.get('id');
  const src=url.searchParams.get('source')||'kw';
  const albumId=url.searchParams.get('album_id')||'';
  if(!id)return json({ok:false,msg:'缺少id'});
  const eng=ENGINES[src];
  if(!eng)return json({ok:false,msg:'未知音源'});
  const levels=LEVELS[src]||['standard'];
  for(const lv of levels){
    try{
      const u=await eng.url(id,lv,albumId);
      if(u)return json({ok:true,url:u,level:lv,source:src});
    }catch(e){}
  }
  return json({ok:false,msg:'该音源未能获取播放链接（可能需要会员或接口变动）'});
}

async function handleProxy(url,req){
  const target=url.searchParams.get('url');
  const src=url.searchParams.get('source')||'kw';
  if(!target)return json({ok:false,msg:'缺少url'});
  const h={'User-Agent':UA,'Referer':REF[src]||''};
  const range=req.headers.get('range');
  if(range)h['Range']=range;
  const up=await fetch(target,{headers:h});
  const rh=new Headers();
  rh.set('access-control-allow-origin','*');
  rh.set('accept-ranges','bytes');
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
  }catch(e){return json({ok:false,msg:'读取音源配置失败',lines:[]});}
}

export async function onRequestGet({request}){
  const url=new URL(request.url);
  const action=url.searchParams.get('action');
  if(action==='search')return handleSearch(url);
  if(action==='url')return handleUrl(url);
  if(action==='proxy')return handleProxy(url,request);
  if(action==='config')return handleConfig(url.searchParams.get('cfg'));
  return json({ok:false,msg:'未知 action'});
}
