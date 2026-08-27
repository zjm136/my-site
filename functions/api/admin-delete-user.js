const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestPost({request,env}){
  const t=(request.headers.get('authorization')||'');const tok=t.startsWith('Bearer ')?t.slice(7):'';
  const u=uname(tok); if(!u) return json({ok:false,msg:'未登录'},401);
  const s=await env.USER_DB.get('s:'+u); if(!s) return json({ok:false,msg:'会话失效'},401);
  const sess=JSON.parse(s); if(sess.token!==tok) return json({ok:false,msg:'token失效'},401);
  const me=await env.USER_DB.get('u:'+u); if(!me) return json({ok:false},401);
  if(!JSON.parse(me).isAdmin) return json({ok:false,msg:'非管理员'},403);
  const {username}=await request.json().catch(()=>null); if(!username) return json({ok:false,msg:'缺少username'},400);
  if(username===u) return json({ok:false,msg:'不能删除自己'},400);
  await env.USER_DB.delete('u:'+username);
  await env.USER_DB.delete('s:'+username);
  await env.USER_DB.delete('quota:'+username);
  return json({ok:true,msg:'已删除用户 '+username});
}
