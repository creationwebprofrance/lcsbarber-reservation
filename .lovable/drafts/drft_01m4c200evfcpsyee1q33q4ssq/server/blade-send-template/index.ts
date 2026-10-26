// Staged only: never deployed from this shared-backend draft.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';
const input=z.object({provider_id:z.uuid(),template_id:z.uuid(),client_id:z.uuid(),booking_id:z.uuid().nullable()});
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return response({error:'Method not allowed'},405);
 // Activation requires explicit deployment and verified sender; fail closed by default.
 if(Deno.env.get('BLADE_EMAIL_ENABLED')!=='true')return response({error:'Manual sends not activated'},503);
 const url=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const apiKey=Deno.env.get('RESEND_API_KEY');const sender=Deno.env.get('BLADE_VERIFIED_SENDER');
 if(!url||!key||!apiKey||!sender)return response({error:'Sender not configured'},503);
 try {
  const db=createClient(url,key);const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return response({error:'Unauthorized'},401);
  const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return response({error:'Unauthorized'},401);
  const parsed=input.safeParse(await req.json());if(!parsed.success)return response({error:'Invalid request'},400);const p=parsed.data;
  const {data:role}=await db.from('user_roles').select('id').eq('user_id',user.id).eq('role','admin').maybeSingle();
  const {data:provider}=await db.from('blade_providers').select('id').eq('id',p.provider_id).eq('user_id',user.id).maybeSingle();
  if(!role||!provider)return response({error:'Forbidden'},403);
  const {data:client}=await db.from('clients').select('*').eq('id',p.client_id).eq('provider_id',p.provider_id).maybeSingle();
  const {data:template}=await db.from('email_templates').select('*').eq('id',p.template_id).eq('provider_id',p.provider_id).maybeSingle();
  if(!client||!template||!z.email().safeParse(client.email).success)return response({error:'Recipient/template not owned'},403);
  let booking=null;
  if(p.booking_id){const {data}=await db.from('bookings').select('*,services(name)').eq('id',p.booking_id).eq('provider_id',p.provider_id).eq('client_id',client.id).maybeSingle();booking=data;if(!booking)return response({error:'Booking not owned'},403);}
  if(!booking&&template.template_type!=='welcome_client')return response({error:'Booking required'},400);
  // Fixed idempotency key prevents repeat sends on retries for this client/template/booking version.
  const values:Record<string,unknown>={clientName:client.name,clientEmail:client.email,client_name:client.name,client_email:client.email,serviceName:booking?.services?.name,service_name:booking?.services?.name,appointmentDate:booking?.appointment_date,appointment_date:booking?.appointment_date,appointmentTime:booking?.appointment_time,appointment_time:booking?.appointment_time,totalPrice:booking?.total_price,total_price:booking?.total_price,clientAddress:booking?.client_address};
  const render=(s:string,html:boolean)=>s.replace(/\{\{\s*(\w+)\s*\}\}/g,(_m,k)=>html?esc(values[k]):String(values[k]??''));
  const idempotency=`blade-${p.provider_id}-${template.id}-${client.id}-${p.booking_id||'welcome'}-${template.updated_at}`;
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotency},body:JSON.stringify({from:sender,to:[client.email],subject:render(template.subject,false),html:render(template.html_content,true)})});
  if(!sent.ok)return response({error:'Email not confirmed'},502);return response({sent:true});
 }catch{return response({error:'Request failed'},500);}
});