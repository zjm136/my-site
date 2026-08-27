const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestGet({request,env}){
  const t=(request.headers.get('authorization')||'');const tok=t.startsWith('Bearer ')?t.slice(7):'';
  const u=uname(tok); if(!u) return json({ok:false,msg:'未登录'},401);
  const s=await env.USER_DB.get('s:'+u); if(!s) return json({ok:false,msg:'会话失效'},401);
  const sess=JSON.parse(s); if(sess.token!==tok) return json({ok:false,msg:'token失效'},401);
  const me=await env.USER_DB.get('u:'+u); if(!me) return json({ok:false},401);
  if(!JSON.parse(me).isAdmin) return json({ok:false,msg:'非管理员'},403);
  const out=[]; let cursor;
  do{
    const page=await env.USER_DB.list({prefix:'u:',cursor});
    for(const k of page.keys){
      const name=k.name.slice(2);
      const v=await env.USER_DB.get(k.name);
      if(!v) continue;
      const d=JSON.parse(v);
      out.push({username:name,isAdmin:!!d.isAdmin,created:d.created||null,usedBytes:+(await env.USER_DB.get('quota:'+name))||0});
    }
    cursor=page.cursor;
  }while(cursor);
  return json({ok:true,users:out});
}
