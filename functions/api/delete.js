const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'};
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
export async function onRequestPost({request,env}){
  const a=await auth(env,request); if(!a.ok) return json(a,a.status);
  const {path,repo}=await request.json().catch(()=>null); if(!path) return json({ok:false,msg:'缺少path'},400);
  if(!path.startsWith('users/'+a.username+'/')) return json({ok:false,msg:'无权'},403);
  try{
    // 先取 sha
    const g=await fetch('https://gitee.com/api/v5/repos/'+env.GITEE_OWNER+'/'+repo+'/contents/'+encodeURIComponent(path)+'?access_token='+env.GITEE_TOKEN);
    const j=await g.json(); const sha=j.sha;
    const r=await fetch('https://gitee.com/api/v5/repos/'+env.GITEE_OWNER+'/'+repo+'/contents/'+encodeURIComponent(path)+'?access_token='+env.GITEE_TOKEN+'&sha='+sha,{method:'DELETE'});
    return json({ok:true,msg:'已删除'});
  }catch(e){return json({ok:false,msg:'删除失败'},500);}
}
