const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
async function isAdmin(env,req){
  const t=(req.headers.get('authorization')||'');const tok=t.startsWith('Bearer ')?t.slice(7):'';
  const u=uname(tok); if(!u) return {ok:false,status:401};
  const s=await env.USER_DB.get('s:'+u); if(!s) return {ok:false,status:401};
  const sess=JSON.parse(s); if(sess.token!==tok) return {ok:false,status:401};
  const me=await env.USER_DB.get('u:'+u); if(!me||!JSON.parse(me).isAdmin) return {ok:false,status:403};
  return {ok:true};
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestGet({request,env}){
  const a=await isAdmin(env,request); if(!a.ok) return json({ok:false,msg:'非管理员'},a.status);
  const key='gitee:repos';
  const list=JSON.parse(await env.USER_DB.get(key)||'[]');
  // 逐个拉 Gitee 仓库真实 size
  const out=await Promise.all(list.map(async rep=>{
    try{
      const r=await fetch('https://gitee.com/api/v5/repos/'+env.GITEE_OWNER+'/'+rep.name+'?access_token='+env.GITEE_TOKEN);
      const j=await r.json();
      const sizeKB=j.size||0; // Gitee 返回的 size 单位 KB
      return {...rep,sizeBytes:sizeKB*1024,usedKB:sizeKB};
    }catch(e){return {...rep,sizeBytes:0,usedKB:0};}
  }));
  return json({ok:true,repos:out,quotaBytes:1024*1024*1024}); // 单仓按 1GB 上限算
}
