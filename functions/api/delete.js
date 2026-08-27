const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestPost({request,env}){
  const t=(request.headers.get('authorization')||'');const tok=t.startsWith('Bearer ')?t.slice(7):'';
  const u=uname(tok); if(!u) return json({ok:false,msg:'未登录'},401);
  const {key}=await request.json().catch(()=>null); if(!key) return json({ok:false,msg:'缺少key'},400);
  if(!key.startsWith('users/'+u+'/')) return json({ok:false,msg:'无权操作'},403);
  const obj=await env.FILES_BUCKET.get(key); if(!obj) return json({ok:false,msg:'文件不存在'},404);
  await env.FILES_BUCKET.delete(key);
  const used=+((await env.USER_DB.get('quota:'+u))||'0');
  await env.USER_DB.put('quota:'+u,String(Math.max(0,used-obj.size)));
  return json({ok:true,msg:'已删除'});
}
