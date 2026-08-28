const CORS={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'};
function json(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:CORS});}
function uname(t){try{return decodeURIComponent(escape(atob(t))).split(':')[0];}catch(e){return '';}}
const QUOTA=1024*1024*1024; // 单仓 1GB
async function auth(env,req){
  const t=(req.headers.get('authorization')||'');const tok=t.startsWith('Bearer ')?t.slice(7):'';
  if(!tok) return {ok:false,status:401};
  const u=uname(tok); if(!u) return {ok:false,status:401};
  const s=await env.USER_DB.get('s:'+u); if(!s) return {ok:false,status:401};
  const sess=JSON.parse(s); if(sess.token!==tok) return {ok:false,status:401};
  return {ok:true,username:u};
}
async function pickRepo(env,req,size){
  const list=JSON.parse(await env.USER_DB.get('gitee:repos')||'[]');
  // C 策略：挑剩余最多的；A 策略：优先默认盘
  const detailed=await Promise.all(list.map(async rep=>{
    try{const r=await fetch('https://gitee.com/api/v5/repos/'+env.GITEE_OWNER+'/'+rep.name+'?access_token='+env.GITEE_TOKEN);const j=await r.json();return {...rep,used: (j.size||0)*1024};}catch(e){return {...rep,used:0};}
  }));
  const fit=detailed.filter(r=>QUOTA-r.used>=size);
  if(!fit.length) return null;
  const def=fit.find(r=>r.is_default);
  return def||fit.sort((a,b)=>(QUOTA-a.used)-(QUOTA-b.used))[0]; // 默认优先，否则剩余最多
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:CORS});}
export async function onRequestPost({request,env}){
  const a=await auth(env,request); if(!a.ok) return json(a,a.status);
  const fd=await request.formData().catch(()=>null); const file=fd?.get('file');
  if(!file||!(file instanceof File)) return json({ok:false,msg:'缺少file'},400);
  if(file.size>100*1024*1024) return json({ok:false,msg:'单文件最大100MB'},413);
  const repo=await pickRepo(env,request,file.size);
  if(!repo) return json({ok:false,msg:'所有盘已满，请到 admin 添加新盘'},507);
  try{
    const path='users/'+a.username+'/'+Date.now()+'_'+file.name;
    const buf=Buffer.from(await file.arrayBuffer()).toString('base64');
    const r=await fetch('https://gitee.com/api/v5/repos/'+env.GITEE_OWNER+'/'+repo.name+'/contents/'+encodeURIComponent(path)+'?access_token='+env.GITEE_TOKEN,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({content:buf,message:'upload: '+file.name})
    });
    const j=await r.json();
    if(j.error) return json({ok:false,msg:j.error_description||'上传失败'},500);
    return json({ok:true,url:j.content?.download_url||j.url,name:file.name,repo:repo.name,path});
  }catch(e){return json({ok:false,msg:'异常: '+e.message},500);}
}
