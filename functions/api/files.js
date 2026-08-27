const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestGet({request,env}){
  const t=(request.headers.get('authorization')||'');const tok=t.startsWith('Bearer ')?t.slice(7):'';
  const u=uname(tok); if(!u) return json({ok:false,msg:'未登录'},401);
  const list=await env.FILES_BUCKET.list({prefix:'users/'+u+'/'});
  const items=list.objects.map(o=>({key:o.key,name:o.key.split('/').pop(),size:o.size,uploaded:o.uploaded?new Date(o.uploaded).getTime():0}));
  const used=+((await env.USER_DB.get('quota:'+u))||'0');
  return json({ok:true,items,usedBytes:used});
}
