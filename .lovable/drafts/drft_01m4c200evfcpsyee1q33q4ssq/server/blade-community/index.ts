// Staged only. Activation, private bucket and media inspection service require approval.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { assistant } from './assistant.ts';
const bucket='blade-work-private';
const enc=new TextEncoder();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const must=(r:{error:unknown;data:unknown})=>{if(r.error)throw new Error('Operation failed');return r.data;};
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function visitor(raw:unknown){const secret=Deno.env.get('BLADE_VISITOR_SECRET');if(!secret)throw new Error('Visitor identity not configured');const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sign=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(v)))).map(n=>n.toString(16).padStart(2,'0')).join('');const parts=typeof raw==='string'?raw.split('.'):[];if(parts.length===2&&uuid(parts[0])&&parts[1]===await sign(parts[0]))return raw as string;const id=crypto.randomUUID();return `${id}.${await sign(id)}`;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(Deno.env.get('BLADE_COMMUNITY_ENABLED')!=='true')return json({error:'BLADE community is not activated'},503);
 try{
 if(req.method!=='POST'||Number(req.headers.get('content-length')??0)>20000)return json({error:'Invalid request'},400);
 const body=await req.json();const action=text(body.action,30);const url=Deno.env.get('SUPABASE_URL');const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!secret)return json({error:'Configuration unavailable'},503);
 const db=createClient(url,secret,{auth:{persistSession:false}});const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');const user=token?(await db.auth.getUser(token)).data.user:null;
 const identity=await visitor(body.visitor_token);const actor=await hash(user?`user:${user.id}`:`guest:${identity}`);
 const ipActor=await hash(`${req.headers.get('x-forwarded-for')??'unknown'}:${action}`);
 if(!(await db.rpc('blade_community_limit',{p_actor:ipActor,p_scope:'requests',p_limit:120,p_seconds:60})).data)return json({error:'Rate limited'},429);
 if(action==='assistant')return assistant(req,body,db,actor);
 const own=async()=>{if(!user)throw new Error('Access denied');const role=await db.from('user_roles').select('role').eq('user_id',user.id).eq('role','admin');if(!role.data?.length)throw new Error('Access denied');const p=await db.from('blade_providers').select('id').eq('user_id',user.id).single();if(!p.data)throw new Error('Provider not linked');return p.data.id as string;};
 const allowed=async(id:string)=>{const pid=await own();const c=await db.from('blade_private_conversations').select('*').eq('id',id).single();if(!c.data||![c.data.provider_a,c.data.provider_b].includes(pid))throw new Error('Access denied');return{pid,c:c.data};};
 const base=()=>db.from('blade_publications').select('*,service:services!inner(id,name,price,duration_minutes,is_active,provider_id)').eq('status','published').eq('ready',true).eq('service.is_active',true);
 const signed=async(path:string|null)=>{if(!path)return null;const r=await db.storage.from(bucket).createSignedUrl(path,120);if(r.error)throw r.error;return r.data.signedUrl;};
 const hydrate=async(row:any)=>{const p=(await db.from('blade_public_profiles').select('*').eq('provider_id',row.provider_id).eq('active',true).maybeSingle()).data;if(!p||row.service?.provider_id!==row.provider_id)return null;const count=await db.from('blade_work_likes').select('*',{count:'exact',head:true}).eq('publication_id',row.id);const liked=(await db.from('blade_work_likes').select('actor_hash').eq('publication_id',row.id).eq('actor_hash',actor)).data?.length>0;return{...row,...p,id:row.id,service_name:row.service.name,price:row.service.price,duration_minutes:row.service.duration_minutes,likes:count.count??0,liked,media_url:await signed(row.media_path),thumbnail_url:await signed(row.thumbnail_path),photo_url:await signed(p.photo_path)};};
 if(action==='feed'){
  const page=Math.max(0,Math.min(100,Number(body.page)||0));let query=base().order('published_at',{ascending:false}).order('id');if(body.category)query=query.eq('category',text(body.category,80));
  const rows=must(await query.range(page*48,page*48+47)) as any[];let items=(await Promise.all(rows.map(hydrate))).filter(Boolean);
  if(body.city)items=items.filter((p:any)=>p.city.toLocaleLowerCase().includes(text(body.city,100).toLocaleLowerCase()));
  if(body.coords){const lat=Number(body.coords.lat),lng=Number(body.coords.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return json({error:'Invalid location'},400);items=items.filter((p:any)=>p.latitude!=null&&p.longitude!=null&&Math.hypot((p.latitude-lat)*111,(p.longitude-lng)*111*Math.cos(lat*Math.PI/180))<=30);}
  const counts=new Map<string,number>();items=items.map((p:any)=>{const rank=counts.get(p.provider_id)??0;counts.set(p.provider_id,rank+1);return{...p,rank};}).sort((a:any,b:any)=>a.rank-b.rank);
  return json({items,hasMore:rows.length===48,categories:[...new Set(items.map((p:any)=>p.category))]});
 }
 if(action==='work'){if(!uuid(body.id))return json({error:'Invalid ID'},400);const row=(await base().eq('id',body.id).maybeSingle()).data;return json(row?await hydrate(row):null);}
 if(action==='profile'){if(!uuid(body.id))return json({error:'Invalid ID'},400);const p=(await db.from('blade_public_profiles').select('*').eq('provider_id',body.id).eq('active',true).maybeSingle()).data;if(!p)return json(null);const services=must(await db.from('services').select('id,name,price,duration_minutes').eq('provider_id',body.id).eq('is_active',true));return json({...p,services,photo_url:await signed(p.photo_path)});}
 if(action==='like'){
  if(!uuid(body.id)||typeof body.liked!=='boolean')return json({error:'Invalid reaction'},400);if(!(await base().eq('id',body.id).maybeSingle()).data)return json({error:'Unavailable work'},404);
  if(!(await db.rpc('blade_community_limit',{p_actor:actor,p_scope:'like',p_limit:30,p_seconds:60})).data)return json({error:'Rate limited'},429);
  if(body.liked)must(await db.from('blade_work_likes').upsert({publication_id:body.id,actor_hash:actor},{onConflict:'publication_id,actor_hash',ignoreDuplicates:true}));else must(await db.from('blade_work_likes').delete().eq('publication_id',body.id).eq('actor_hash',actor));
  const count=await db.from('blade_work_likes').select('*',{head:true,count:'exact'}).eq('publication_id',body.id);return json({likes:count.count,liked:body.liked,visitor_token:user?undefined:identity});
 }
 if(action==='directory'){await own();return json(must(await db.from('blade_public_profiles').select('provider_id,name,city').eq('active',true).ilike('name',`%${text(body.q,80).replace(/[%_]/g,'')}%`).limit(30))?.map((p:any)=>({...p,id:p.provider_id})));}
 if(action==='conversation'){const pid=await own();if(!uuid(body.provider_id)||pid===body.provider_id)return json({error:'Invalid participant'},400);if(!(await db.from('blade_public_profiles').select('provider_id').eq('provider_id',body.provider_id).eq('active',true).maybeSingle()).data)return json({error:'Unavailable provider'},404);const [a,b]=[pid,body.provider_id].sort();must(await db.from('blade_private_conversations').upsert({provider_a:a,provider_b:b},{onConflict:'provider_a,provider_b',ignoreDuplicates:true}));return json(must(await db.from('blade_private_conversations').select('id').eq('provider_a',a).eq('provider_b',b).single()));}
 if(action==='conversations'){const pid=await own();const rows=must(await db.from('blade_private_conversations').select('*').or(`provider_a.eq.${pid},provider_b.eq.${pid}`).order('created_at',{ascending:false}).limit(100)) as any[];return json(await Promise.all(rows.map(async c=>{const other=c.provider_a===pid?c.provider_b:c.provider_a;const profile=(await db.from('blade_public_profiles').select('name').eq('provider_id',other).maybeSingle()).data;const read=(await db.from('blade_message_reads').select('read_at').eq('provider_id',pid).eq('conversation_id',c.id).maybeSingle()).data;let count=db.from('blade_private_messages').select('*',{head:true,count:'exact'}).eq('conversation_id',c.id).neq('sender_id',pid);if(read)count=count.gt('created_at',read.read_at);return{id:c.id,other_id:other,name:profile?.name??'',unread:(await count).count??0};})));}
 if(['messages','send','read'].includes(action)){if(!uuid(body.id))return json({error:'Invalid conversation'},400);const {pid}=await allowed(body.id);
  if(action==='messages')return json(must(await db.from('blade_private_messages').select('id,sender_id,body,created_at').eq('conversation_id',body.id).order('created_at',{ascending:false}).limit(100))?.reverse());
  if(action==='read'){must(await db.from('blade_message_reads').upsert({conversation_id:body.id,provider_id:pid,read_at:new Date().toISOString()}));return json({ok:true});}
  if(!uuid(body.request_id)||typeof body.body!=='string'||!body.body.trim()||body.body.length>2000)return json({error:'Invalid message'},400);
  if(!(await db.rpc('blade_community_limit',{p_actor:actor,p_scope:'message',p_limit:30,p_seconds:60})).data)return json({error:'Rate limited'},429);
  must(await db.from('blade_private_messages').upsert({conversation_id:body.id,sender_id:pid,body:body.body.trim(),request_id:body.request_id},{onConflict:'sender_id,request_id',ignoreDuplicates:true}));return json({ok:true});
 }
 if(action==='save-profile'){const pid=await own();const v=body.values??{};if(!text(v.name,150)||!text(v.city,100)||!text(v.zone,200))return json({error:'Invalid profile'},400);must(await db.from('blade_public_profiles').upsert({provider_id:pid,name:text(v.name,150),city:text(v.city,100),zone:text(v.zone,200),home:v.home===true,near:v.near===true,active:v.active===true,updated_at:new Date().toISOString()}));return json({ok:true});}
 const pid=await own();
 if(action==='own')return json(must(await db.from('blade_publications').select('*').eq('provider_id',pid).neq('status','deleted').order('created_at',{ascending:false}).limit(100)));
 if(action==='status'){if(!uuid(body.id)||!['published','hidden','deleted'].includes(body.status))return json({error:'Invalid status'},400);const row=must(await db.from('blade_publications').select('*').eq('id',body.id).eq('provider_id',pid).single()) as any;must(await db.from('blade_publications').update({status:body.status}).eq('id',row.id).eq('provider_id',pid));if(body.status==='deleted')must(await db.storage.from(bucket).remove([row.media_path,row.thumbnail_path].filter(Boolean)));return json({ok:true});}
 if(action==='save'||action==='upload'){
 const v=body.values??{};if(!uuid(v.service_id)||text(v.title,151).length<2||text(v.title,151).length>150||!text(v.category,80))return json({error:'Invalid work'},400);if(!(await db.from('services').select('id').eq('id',v.service_id).eq('provider_id',pid).eq('is_active',true).maybeSingle()).data)return json({error:'Service not owned'},403);
 const values={service_id:v.service_id,title:text(v.title,150),category:text(v.category,80),description:text(v.description,2000)};
 if(action==='save'){if(!uuid(body.id))return json({error:'Invalid ID'},400);must(await db.from('blade_publications').update(values).eq('id',body.id).eq('provider_id',pid).select('id').single());return json({id:body.id});}
 const image=['image/jpeg','image/png','image/webp'].includes(body.type);const video=['video/mp4','video/webm'].includes(body.type);if((!image&&!video)||!Number.isInteger(body.size)||body.size<1||body.size>(image?10485760:52428800)||(video&&(!body.thumbnail||!Number.isFinite(v.duration)||v.duration<=0||v.duration>60)))return json({error:'Invalid media'},400);
 if(body.thumbnail&&(!['image/jpeg','image/png','image/webp'].includes(body.thumbnail.type)||body.thumbnail.size<1||body.thumbnail.size>10485760))return json({error:'Invalid thumbnail'},400);
 const id=crypto.randomUUID(),path=`${pid}/${id}/original`,thumb=video?`${pid}/${id}/thumbnail`:null;
 must(await db.from('blade_publications').insert({id,provider_id:pid,...values,kind:image?'image':'video',mime_type:body.type,size_bytes:body.size,duration_seconds:video?v.duration:null,media_path:path,thumbnail_path:thumb,status:'processing'}));
 const ticket=must(await db.storage.from(bucket).createSignedUploadUrl(path)) as any;const thumbnail=thumb?must(await db.storage.from(bucket).createSignedUploadUrl(thumb)):null;return json({id,...ticket,thumbnail});
 }
 if(action==='finalize'){
  if(!uuid(body.id))return json({error:'Invalid ID'},400);const row=must(await db.from('blade_publications').select('*').eq('id',body.id).eq('provider_id',pid).eq('status','processing').single()) as any;
  // Inspection must decode the uploaded media server-side. Never trust browser duration/MIME.
  const inspector=Deno.env.get('BLADE_MEDIA_INSPECTOR_URL'),inspectionKey=Deno.env.get('BLADE_MEDIA_INSPECTOR_KEY');if(!inspector||!inspectionKey)return json({error:'Media processing is not activated'},503);
  const res=await fetch(inspector,{method:'POST',headers:{Authorization:`Bearer ${inspectionKey}`,'Content-Type':'application/json'},body:JSON.stringify({url:await signed(row.media_path),thumbnail_url:await signed(row.thumbnail_path)}),signal:req.signal});if(!res.ok)throw new Error('Inspection failed');const verified=await res.json();const valid=verified.mime===row.mime_type&&verified.bytes===row.size_bytes&&verified.width>0&&verified.height>0&&(row.kind==='image'||(verified.duration>0&&verified.duration<=60&&verified.thumbnail_valid===true));
  must(await db.from('blade_publications').update({ready:valid,status:valid?'draft':'error',duration_seconds:row.kind==='video'?verified.duration:null}).eq('id',row.id).eq('provider_id',pid));return valid?json({ok:true}):json({error:'Media rejected'},400);
 }
 return json({error:'Unknown action'},400);
 }catch{return json({error:'Action unavailable or not permitted'},403);}
});