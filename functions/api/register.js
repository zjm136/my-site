const enc=new TextEncoder();
const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'content-type'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
async function sha256(hex){const h=await crypto.subtle.digest('SHA-256',enc.encode(hex));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestPost({request,env}){
  const {username,password}=await request.json().catch(()=>null);
  if(!username||!password) return json({ok:false,msg:'账号名和密码必填'});
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return json({ok:false,msg:'账号名3-20位，仅字母数字下划线'});
  if(password.length<6) return json({ok:false,msg:'密码至少6位'});
  if(await env.USER_DB.get('u:'+username)) return json({ok:false,msg:'账号名已存在'});
  const hash=await sha256(password);
  await env.USER_DB.put('u:'+username,JSON.stringify({hash,isAdmin:username==='admin',created:Date.now()}));
  return json({ok:true,msg:'注册成功'});
}
