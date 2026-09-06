// 青听风格音乐引擎 v2 — Cloudflare Pages Function
// 修复：JSONP解析、多接口回退、Cookie初始化、自检
const CORS={'content-type':'application/json;charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MUA='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
const REF={kw:'https://www.kuwo.cn/',kg:'https://www.kugou.com/',wy:'https://music.163.com/',tx:'https://y.qq.com/',bili:'https://www.bilibili.com/',mg:'https://music.migu.cn/'};
function strip(s){return String(s||'').replace(/<[^>]+>/g,'').trim();}

// 通用：拿文本，容忍 JSONP / jQuery 包裹 / 多余字符
async function grab(url,headers){
  const r=await fetch(url,{headers:Object.assign({'User-Agent':UA},headers||{})});
  return {r,text:await r.text()};
}
// 通用：尽力解析成 JSON（剥 JSONP / jQuery / 取首个 {...}）
function parseLoose(text){
  if(!text)return null;
  let t=text.trim();
  try{return JSON.parse(t);}catch(e){}
  // jQuery12345({...}) 或 cb({...})
  let m=t.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
  if(m){try{return JSON.parse(m[1]);}catch(e){}}
  // 直接截取第一个 { 到最后一个 }
  const i=t.indexOf('{'),j=t.lastIndexOf('}');
  if(i>=0&&j>i){try{return JSON.parse(t.slice(i,j+1));}catch(e){}}
  return null;
}
async function getJSON(url,headers){
  const {r,text}=await grab(url,headers);
  if(!r.ok)return null;
  return parseLoose(text);
}
// 生成随机 guid（QQ 用）
function rnd(n){let s='';for(let i=0;i<n;i++)s+=Math.floor(Math.random()*10);return s;}

/* ================= 酷我 kw ================= */
async function kwSearch(kw,page,size){
  const urls=[
    `https://search.kuwo.cn/r.s?all=${encodeURIComponent(kw)}&ft=music&itemset=web_2013&client=kt&pn=${(page-1)*size}&rn=${size}&rformat=json&encoding=utf8`,
    `https://search.kuwo.cn/r.s?all=${encodeURIComponent(kw)}&ft=music&client=kt&pn=${(page-1)*size}&rn=${size}&rformat=json&encoding=utf8&vipver=MUSIC_8.7.7.0`
  ];
  for(const u of urls){
    const j=await getJSON(u,{'Referer':REF.kw});
    const list=j&&(j.abslist||j.ABLIST||(j.data&&j.data.list));
    if(Array.isArray(list)&&list.length){
      return list.map(x=>{
        const rid=x.MUSICRID||x.musicrid||'';
        return {id:rid.replace('MUSIC_',''),name:strip(x.SONGNAME||x.songname||x.name),artist:strip(x.ARTIST||x.artist),album:strip(x.ALBUM||x.album),source:'kw'};
      }).filter(x=>x.id&&x.name);
    }
  }
  return [];
}
async function kwUrl(id,level){
  const br={standard:'128kmp3',exhigh:'192kmp3',lossless:'320kmp3'}[level]||'128kmp3';
  const urls=[
    `https://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_${id}&format=${level==='lossless'?'flac':'mp3'}&response=url&br=${br}`,
    `https://www.kuwo.cn/api/v1/www/music/playUrl?mid=${id}&type=convert_url3&br=${br}`,
    `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_${id}&format=mp3&response=url`
  ];
  for(const u of urls){
    try{
      const {r,text}=await grab(u,{'Referer':REF.kw});
      if(!r.ok)continue;
      // 纯文本 URL 直接返回
      if(/^https?:\/\//.test(text.trim()))return text.trim();
      const j=parseLoose(text);
      if(j&&j.data&&j.data.url)return j.data.url;
      if(j&&j.url)return j.url;
    }catch(e){}
  }
  return null;
}

/* ================= 酷狗 kg ================= */
async function kgSearch(kw,page,size){
  const urls=[
    `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(kw)}&page=${page}&pagesize=${size}`,
    `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(kw)}&page=${page}&pagesize=${size}&platform=WebFilter`
  ];
  for(const u of urls){
    const j=await getJSON(u,{'Referer':REF.kg});
    let list=j&&((j.data&&(j.data.info||j.data.lists))||j.lists);
    if(Array.isArray(list)&&list.length){
      return list.map(x=>({
        id:x.hash||x.FileHash||x.HASH,
        album_id:x.album_id||x.album_audio_id||x.AlbumID||'',
        name:strip(x.songname||x.SongName),
        artist:strip(x.singername||x.SingerName),
        album:strip(x.album_name||x.AlbumName),
        source:'kg'
      })).filter(x=>x.id&&x.name);
    }
  }
  return [];
}
async function kgUrl(id,level,albumId){
  const dfid='0THXdR3FLc9C0ag4Tx1Pg6XO';
  const mid=rnd(32);
  const urls=[];
  if(albumId)urls.push(`https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${id}&album_id=${albumId}&dfid=${dfid}&mid=${mid}&platid=4&appid=1014`);
  urls.push(`https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${id}&dfid=${dfid}&mid=${mid}&platid=4&appid=1014`);
  urls.push(`http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${id}`);
  for(const u of urls){
    try{
      const {r,text}=await grab(u,{'Referer':REF.kg});
      if(!r.ok)continue;
      const j=parseLoose(text);
      if(!j)continue;
      const d=j.data||j;
      const url=d.play_url||d.playUrl||d.url||d.play_backup_url||d.backup_url;
      if(url&&String(url).startsWith('http'))return String(url).replace(/\\/g,'');
    }catch(e){}
  }
  return null;
}

/* ================= 网易云 wy ================= */
async function wySearch(kw,page,size){
  const off=(page-1)*size;
  const urls=[
    `https://music.163.com/api/cloudsearch/pc?s=${encodeURIComponent(kw)}&type=1&offset=${off}&limit=${size}`,
    `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(kw)}&type=1&offset=${off}&total=true&limit=${size}`,
    `https://music.163.com/api/search/pc?s=${encodeURIComponent(kw)}&type=1&offset=${off}&limit=${size}`
  ];
  for(const u of urls){
    const j=await getJSON(u,{'Referer':REF.wy,'Cookie':'appver=2.0.2;os=pc;NMTID='+rnd(20)});
    const arr=j&&(j.result&&(j.result.songs||j.result.song));
    if(Array.isArray(arr)&&arr.length){
      return arr.map(x=>({
        id:String(x.id),
        name:strip(x.name),
        artist:(x.artists||x.ar||[]).map(a=>a.name).join('、'),
        album:x.album?strip(x.album.name):(x.al?strip(x.al.name):''),
        source:'wy'
      })).filter(x=>x.id&&x.name);
    }
  }
  return [];
}
async function wyUrl(id){
  const urls=[
    `https://music.163.com/api/song/enhance/player/url?id=${id}&ids=%5B${id}%5D&br=128000`,
    `https://music.163.com/song/media/outer/url?id=${id}.mp3`
  ];
  for(const u of urls){
    try{
      if(u.includes('outer/url')){
        const {r}=await grab(u,{'Referer':REF.wy});
        if(r.url&&/\.(mp3|m4a|flac)/.test(r.url))return r.url;
        continue;
      }
      const j=await getJSON(u,{'Referer':REF.wy,'Cookie':'appver=2.0.2;os=pc'});
      if(j&&j.data&&j.data[0]&&j.data[0].url)return j.data[0].url;
    }catch(e){}
  }
  return null;
}

/* ================= QQ tx ================= */
async function txSearch(kw,page,size){
  const urls=[
    `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=${size}&w=${encodeURIComponent(kw)}&format=json`,
    `https://c.y.qq.com/soso/fcgi-bin/client_music_search_songlist?p=${page}&n=${size}&w=${encodeURIComponent(kw)}&format=json`
  ];
  for(const u of urls){
    const j=await getJSON(u,{'Referer':REF.tx});
    const arr=j&&j.data&&j.data.song&&j.data.song.list;
    if(Array.isArray(arr)&&arr.length){
      return arr.map(x=>({
        id:x.songmid||x.mid||'',
        name:strip(x.songname||x.name),
        artist:(x.singer||[]).map(s=>s.name).join('、'),
        album:strip(x.albumname),
        source:'tx'
      })).filter(x=>x.id&&x.name);
    }
  }
  return [];
}
async function txUrl(id,level){
  const guid=rnd(10);
  // filename 按音质：M500=128K, M800=320K, C400=m4a
  const fn = level==='lossless' ? `M800${id}.mp3` : (level==='exhigh'?`M800${id}.mp3`:`M500${id}.mp3`);
  const urls=[
    `https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?format=json205361747&platform=yqq&cid=205361747&songmid=${id}&filename=${fn}&guid=${guid}`,
    `https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?format=json&cid=205361747&songmid=${id}&filename=${fn}&guid=${guid}&platform=yqq`,
    `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify({req_0:{module:'vkey.GetVkeyServer',method:'CgiGetVkey',param:{guid, songmid:[id], songtype:[0], uin:'0', loginflag:1, platform:'20'}}}))}`
  ];
  for(const u of urls){
    try{
      const j=await getJSON(u,{'Referer':REF.tx});
      if(!j)continue;
      let vkey=null;
      if(j.data&&j.data.items&&j.data.items[0])vkey=j.data.items[0].vkey;
      if(!vkey&&j.req_0&&j.req_0.data&&j.req_0.data.midurlinfo&&j.req_0.data.midurlinfo[0]){
        const item=j.req_0.data.midurlinfo[0];
        if(item.purl)return `https://isure.stream.qqmusic.qq.com/${item.purl}`;
        vkey=item.vkey;
      }
      if(vkey&&vkey.length>10){
        return `https://isure.stream.qqmusic.qq.com/${fn}?vkey=${vkey}&guid=${guid}&uin=0&fromtag=66`;
      }
    }catch(e){}
  }
  return null;
}

/* ================= B站 bili（需 Cookie） ================= */
async function biliSearch(kw,page,size){
  try{
    // 先访问首页拿 buvid3 cookie
    const home=await fetch('https://www.bilibili.com/',{headers:{'User-Agent':UA}});
    const setCookie=home.headers.get('set-cookie')||'';
    const m=setCookie.match(/buvid3=([^;]+)/);
    const cookie=m?`buvid3=${m[1]}`:'buvid3='+rnd(32)+'infoc';
    const u=`https://api.bilibili.com/x/web-interface/search/type?search_type=audio&keyword=${encodeURIComponent(kw)}&page=${page}`;
    const j=await getJSON(u,{'Referer':REF.bili,'Cookie':cookie});
    const arr=j&&j.data&&j.data.result;
    if(Array.isArray(arr)&&arr.length){
      return arr.slice(0,size).map(x=>({id:String(x.id),name:strip(x.title),artist:strip(x.author),cover:x.cover?('https:'+x.cover):'',source:'bili'})).filter(x=>x.id&&x.name);
    }
  }catch(e){}
  return [];
}
async function biliUrl(id){
  try{
    const j=await getJSON(`https://www.bilibili.com/audio/music-service-c/web/url?sid=${id}`,{'Referer':REF.bili});
    if(j&&j.data&&j.data.cdns&&j.data.cdns.length)return j.data.cdns[0];
  }catch(e){}
  return null;
}

/* ================= 咪咕 mg（需签名，暂不可用） ================= */
async function mgSearch(){return [];}
async function mgUrl(){return null;}

const ENGINES={kw:{search:kwSearch,url:kwUrl},kg:{search:kgSearch,url:kgUrl},wy:{search:wySearch,url:wyUrl},tx:{search:txSearch,url:txUrl},bili:{search:biliSearch,url:biliUrl},mg:{search:mgSearch,url:mgUrl}};
const LEVELS={kw:['standard','exhigh','lossless'],kg:['standard','exhigh','lossless'],wy:['standard','exhigh','lossless'],tx:['standard','exhigh','lossless'],bili:['bili192'],mg:['standard']};

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
    if(!list.length)return json({ok:true,source:src,list:[],msg:'该源未返回结果（接口风控或已失效）'});
    return json({ok:true,source:src,list});
  }catch(e){return json({ok:false,msg:'搜索失败: '+e.message});}
}

async function handleUrl(url){
  const id=url.searchParams.get('id');
  const src=url.searchParams.get('source')||'kw';
  const albumId=url.searchParams.get('album_id')||'';
  const wantLv=url.searchParams.get('level')||'';
  if(!id)return json({ok:false,msg:'缺少id'});
  const eng=ENGINES[src];
  if(!eng)return json({ok:false,msg:'未知音源'});
  const base=LEVELS[src]||['standard'];
  const order=wantLv?[wantLv,...base.filter(l=>l!==wantLv)]:base;
  for(const lv of order){
    try{
      const u=await eng.url(id,lv,albumId);
      if(u)return json({ok:true,url:u,level:lv,source:src});
    }catch(e){}
  }
  return json({ok:false,msg:'该音源未能获取播放链接（平台风控，换小狗源/小窝源试试）'});
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

// 自检：逐个源试搜索+取链，返回哪个活着
async function handleTest(url){
  const kw=url.searchParams.get('keyword')||'起风了';
  const out=[];
  for(const key of Object.keys(ENGINES)){
    const eng=ENGINES[key];
    const rec={source:key,search:false,url:false,note:''};
    try{
      const list=await eng.search(kw,1,3);
      rec.search=list.length>0;
      rec.count=list.length;
      if(rec.search){
        const u=await eng.url(list[0].id,(LEVELS[key]||['standard'])[0],list[0].album_id||'');
        rec.url=!!u;
        if(u)rec.sample=String(u).slice(0,80);
      }else{rec.note='搜索无结果';}
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
  return json({ok:false,msg:'未知 action'});
}
