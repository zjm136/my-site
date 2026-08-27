const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestGet({request,env}){
  const t=request.headers.get('authorization')||''; const tok=t.startsWith('Bearer ')?t.slice(7):'';
  const u=uname(tok); if(!u) return json({ok:false},401);
  const s=await env.USER_DB.get('s:'+u); if(!s) return json({ok:false},401);
  const sess=JSON.parse(s); if(sess.token!==tok) return json({ok:false},401);
  return json({ok:true,username:u});
}
