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
  const {name,label}=await request.json().catch(()=>null);
  if(!name) return json({ok:false,msg:'缺少仓库名'},400);
  const repo=name.replace(/[^a-zA-Z0-9_-]/g,'-').toLowerCase();
  try{
    const r=await fetch('https://gitee.com/api/v5/user/repos?access_token='+env.GITEE_TOKEN,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({name:repo,private:true,description:label||(repo+' 存储盘'),auto_init:true})
    });
    const j=await r.json();
    if(j.error) return json({ok:false,msg:j.error_description||j.error||'建仓失败'},500);
    // 记录到 KV 盘列表
    const key='gitee:repos';
    const list=JSON.parse(await env.USER_DB.get(key)||'[]');
    if(!list.find(x=>x.name===repo)) list.push({name:repo,label:label||repo,is_default:list.length===0});
    await env.USER_DB.put(key,JSON.stringify(list));
    return json({ok:true,msg:'已创建私有仓 '+repo,repo:j});
  }catch(e){return json({ok:false,msg:'异常: '+e.message},500);}
}
