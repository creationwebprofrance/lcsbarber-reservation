import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
export const COMMUNITY_ACTIVE = false; // Enable only after schema, private storage and server activation are verified.
const db=supabase as SupabaseClient;
export type PublicWork={id:string;provider_id:string;service_id:string;title:string;description:string|null;category:string;kind:'image'|'video';name:string;city:string;zone:string;home:boolean;near:boolean;photo_url:string|null;price:number;service_name:string;duration_minutes:number;booking_path:string|null;likes:number;liked:boolean;media_url:string;thumbnail_url:string|null;status:'draft'|'processing'|'published'|'hidden'|'error';published_at:string|null};
export type PublicProvider={provider_id:string;name:string;city:string;zone:string;home:boolean;near:boolean;photo_url:string|null;booking_path:string|null;services:{id:string;name:string;price:number;duration_minutes:number}[]};
export function useCommunityRead<T>(load:()=>Promise<T>,deps:unknown[]=[]) {
 const [state,setState]=useState<{data:T|null;loading:boolean;error:string|null}>({data:null,loading:COMMUNITY_ACTIVE,error:null});
 useEffect(()=>{if(!COMMUNITY_ACTIVE)return;let alive=true;setState(s=>({...s,loading:true,error:null}));load().then(data=>{if(alive)setState({data,loading:false,error:null});}).catch(()=>{if(alive)setState({data:null,loading:false,error:'unavailable'});});return()=>{alive=false;};},deps);
 return state;
}
async function invoke<T>(action:string,values:Record<string,unknown>={}):Promise<T>{let visitor='';try{visitor=localStorage.getItem('blade-visitor')??'';}catch{}const {data,error}=await supabase.functions.invoke('blade-community',{body:{action,visitor_token:visitor,...values}});if(error||data?.error)throw new Error('unavailable');return data as T;}
export const listWorks=(filters:Record<string,unknown>)=>invoke<{items:PublicWork[];hasMore:boolean;categories:string[]}>('feed',filters);
export const workById=(id:string)=>invoke<PublicWork|null>('work',{id});
export const providerById=(id:string)=>invoke<PublicProvider|null>('profile',{id});
export const ownWorks=()=>invoke<PublicWork[]>('own');
export const saveWork=(id:string|null,values:Record<string,unknown>)=>invoke<{id:string}>('save',{id,values});
export const workAction=(id:string,status:string)=>invoke('status',{id,status});
export async function setLike(id:string,liked:boolean) {
 let token='';try{token=localStorage.getItem('blade-visitor')??'';}catch{}
 const result=await invoke<{likes:number;liked:boolean;visitor_token?:string}>('like',{id,liked,visitor_token:token});
 if(result.visitor_token)try{localStorage.setItem('blade-visitor',result.visitor_token);}catch{}
 return result;
}
export async function uploadWork(file:File,thumbnail:File|null,values:Record<string,unknown>,progress:(n:number)=>void) {
 const ticket=await invoke<{id:string;url:string;token:string;path:string;thumbnail?:{url:string;token:string;path:string}}>('upload',{values,type:file.type,size:file.size,thumbnail:thumbnail?{type:thumbnail.type,size:thumbnail.size}:null});
 const put=(url:string,_token:string,body:File,start:number,span:number)=>new Promise<void>((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('PUT',url);xhr.setRequestHeader('Content-Type',body.type);xhr.setRequestHeader('x-upsert','false');xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(start+span*e.loaded/e.total);};xhr.onerror=()=>reject(new Error('upload'));xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('upload'));xhr.send(body);});
 await put(ticket.url,ticket.token,file,0,thumbnail?85:95);if(thumbnail&&ticket.thumbnail)await put(ticket.thumbnail.url,ticket.thumbnail.token,thumbnail,85,10);
 await invoke('finalize',{id:ticket.id});progress(100);return ticket.id;
}
export type Conversation={id:string;other_id:string;name:string;unread:number};
export type PrivateMessage={id:string;sender_id:string;body:string;created_at:string};
export const conversations=()=>invoke<Conversation[]>('conversations');
export const directory=(q:string)=>invoke<{id:string;name:string;city:string}[]>('directory',{q});
export const openConversation=(provider_id:string)=>invoke<{id:string}>('conversation',{provider_id});
export const readMessages=(id:string)=>invoke<PrivateMessage[]>('messages',{id});
export const sendMessage=(id:string,body:string,request_id:string)=>invoke('send',{id,body,request_id});
export const markRead=(id:string)=>invoke('read',{id});
export const savePublicProfile=(values:Record<string,unknown>)=>invoke('save-profile',{values});
export const privateRealtime=(conversation:string,onChange:()=>void)=>{const channel=db.channel(`blade-dm-${conversation}-${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'blade_private_messages',filter:`conversation_id=eq.${conversation}`},onChange).subscribe();return()=>{void supabase.removeChannel(channel);};};