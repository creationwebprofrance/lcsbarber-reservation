import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, X } from 'lucide-react';
import { BladeButton } from './common';
import { useBladePreferences } from './preferences';
import avatar from './assets/assistant.asset.json';
export const ASSISTANT_ACTIVE=false;
export function BladeAssistant(){const {t}=useBladePreferences();const [open,setOpen]=useState(false);const [reader,setReader]=useState(false);const [question,setQuestion]=useState('');const [answer,setAnswer]=useState('');const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{const yes=()=>setReader(true);const no=()=>setReader(false);document.addEventListener('blade-reader-open',yes);document.addEventListener('blade-reader-close',no);return()=>{document.removeEventListener('blade-reader-open',yes);document.removeEventListener('blade-reader-close',no);};},[]);
 useEffect(()=>{if(open)heading.current?.focus();},[open]);if(reader)return null;
 return <div className="blade-assistant blade-app">{open&&<section className="blade-assistant-window" aria-label={t('assistant')}><header><h2 ref={heading} tabIndex={-1}>{t('assistant')}</h2><BladeButton aria-label={t('close')} onClick={()=>setOpen(false)}><X size={18}/></BladeButton></header><p className="blade-note">{t('assistantUnavailable')}</p><div className="blade-assistant-suggestions">{(['suggestFind','suggestTravel','suggestBooking'] as const).map((key,i)=><BladeButton key={key} onClick={()=>setAnswer(t((['faqFind','faqTravel','faqBooking'] as const)[i]))}>{t(key)}</BladeButton>)}</div>{answer&&<p role="status">{answer}</p>}<BladeButton asChild><Link to="/blade/client">{t('find')}</Link></BladeButton><form onSubmit={e=>e.preventDefault()} className="blade-chat-reply"><input aria-label={t('question')} value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000}/><BladeButton type="submit" disabled={!ASSISTANT_ACTIVE} aria-label={t('send')}><Send size={18}/></BladeButton></form></section>}<BladeButton className="blade-assistant-trigger" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><img src={avatar.url} alt=""/>{t('needHelp')}</BladeButton></div>;
}