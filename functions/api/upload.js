const enc=new TextEncoder();
const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
async function auth(env,req){
  const t=(req.headers.get('authorization')||'');const tok=t.startsWith('Bearer ')?t.slice(7):'';
  if(!tok)return {ok:false,msg:'未登录',status:401};
  const u=uname(tok);if(!u)return {ok:false,msg:'token无效',status:401};
  const s=await env.USER_DB.get('s:'+u);if(!s)return {ok:false,msg:'会话失效',status:401};
  const sess=JSON.parse(s);if(sess.token!==tok)return {ok:false,msg:'token失效',status:401};
  return {ok:true,username:u};
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestPost({request,env}){
  const a=await auth(env,request); if(!a.ok) return json(a,a.status);
  const fd=await request.formData().catch(()=>null); const file=fd?.get('file');
  if(!file||!(file instanceof File)) return json({ok:false,msg:'缺少file字段'},400);
  const MAX=10*1024*1024, QUOTA=200*1024*1024;
  if(file.size>MAX) return json({ok:false,msg:'单文件最大10MB'},413);
  const used=+((await env.USER_DB.get('quota:'+a.username))||'0');
  if(used+file.size>QUOTA) return json({ok:false,msg:'本账号空间已满(200MB)'},413);
  const ext=(file.name.split('.').pop()||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,6);
  const key='users/'+a.username+'/'+Date.now()+'_'+crypto.randomUUID().slice(0,8)+(ext?'.'+ext:'');
  const buf=new Uint8Array(await file.arrayBuffer());
  await env.FILES_BUCKET.put(key,buf,{httpMetadata:{contentType:file.type||'application/octet-stream',cacheControl:'public, max-age=31536000'}});
  await env.USER_DB.put('quota:'+a.username,String(used+buf.length));
  const base=env.R2_PUBLIC_BASE||'';
  return json({ok:true,url:base+'/'+key,name:file.name,key,size:file.size});
}
