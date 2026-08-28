const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
async function auth(env,req){
  const t=(req.headers.get('authorization')||'');const tok=t.startsWith('Bearer ')?t.slice(7):'';
  if(!tok) return {ok:false,status:401};
  const u=uname(tok); if(!u) return {ok:false,status:401};
  const s=await env.USER_DB.get('s:'+u); if(!s) return {ok:false,status:401};
  const sess=JSON.parse(s); if(sess.token!==tok) return {ok:false,status:401};
  return {ok:true,username:u};
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestGet({request,env}){
  const a=await auth(env,request); if(!a.ok) return json(a,a.status);
  const url=new URL(request.url);
  const repo=url.searchParams.get('repo')||'';
  const list=JSON.parse(await env.USER_DB.get('gitee:repos')||'[]');
  const target=repo||(list.find(x=>x.is_default)?.name)||list[0]?.name;
  if(!target) return json({ok:true,items:[]});
  try{
    const r=await fetch('https://gitee.com/api/v5/repos/'+env.GITEE_OWNER+'/'+target+'/contents/users/'+a.username+'?access_token='+env.GITEE_TOKEN);
    const j=await r.json();
    const items=Array.isArray(j)?j.map(f=>({name:f.name,url:f.download_url,path:f.path,size:f.size})).filter(x=>x.name!=='.gitkeep'):[];
    return json({ok:true,items,repo:target});
  }catch(e){return json({ok:false,msg:'列表失败'},500);}
}
