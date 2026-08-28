const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'};
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
export async function onRequestPost({request,env}){
  const a=await isAdmin(env,request); if(!a.ok) return json({ok:false,msg:'非管理员'},a.status);
  const {name}=await request.json().catch(()=>null); if(!name) return json({ok:false,msg:'缺少仓库名'},400);
  const key='gitee:repos';
  let list=JSON.parse(await env.USER_DB.get(key)||'[]');
  list.forEach(x=>x.is_default=(x.name===name));
  await env.USER_DB.put(key,JSON.stringify(list));
  return json({ok:true,msg:'已设 '+name+' 为默认盘'});
}
