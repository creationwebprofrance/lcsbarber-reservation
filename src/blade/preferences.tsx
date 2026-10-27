import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Globe, Sun, Moon, Monitor } from 'lucide-react';
import { fr, en, es, type TextKey } from './translations';
export type Language = 'fr' | 'en' | 'es';
type Theme = 'light' | 'dark' | 'system';
function stored(key: string, fallback: string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
const initialLanguage = stored('blade-language','fr');
const initialTheme = stored('blade-theme','light');
const defaults = { language: (['fr','en','es'].includes(initialLanguage)?initialLanguage:'fr') as Language, theme: (['light','dark','system'].includes(initialTheme)?initialTheme:'light') as Theme };
function applyTheme(theme: Theme) { document.documentElement.dataset.bladeTheme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') : theme; }
applyTheme(defaults.theme);
const Preferences = createContext({ ...defaults, setLanguage: (_:Language)=>{}, setTheme: (_:Theme)=>{}, t: (key:TextKey):string => fr[key] });
export function BladePreferences({children}:{children:ReactNode}) {
  const [language,setLanguage]=useState(defaults.language); const [theme,setTheme]=useState(defaults.theme);
  useEffect(()=>{ document.documentElement.lang=language; try { localStorage.setItem('blade-language',language); } catch {} },[language]);
  useEffect(()=>{ applyTheme(theme); try {localStorage.setItem('blade-theme',theme);} catch {} const mq=matchMedia('(prefers-color-scheme: dark)'); const change=()=>applyTheme(theme); mq.addEventListener('change',change); return ()=>mq.removeEventListener('change',change); },[theme]);
  return <Preferences.Provider value={{language,theme,setLanguage,setTheme,t:key=>({fr,en,es}[language][key])}}>{children}</Preferences.Provider>;
}
export const useBladePreferences=()=>useContext(Preferences);
export function PreferenceControls() {
 const {language,theme,setLanguage,setTheme,t}=useBladePreferences(); const ThemeIcon=theme==='light'?Sun:theme==='dark'?Moon:Monitor;
 return <div className="blade-preferences"><label title={t('language')}><Globe size={16}/><select aria-label={t('language')} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option></select></label><label title={t('theme')}><ThemeIcon size={16}/><select aria-label={t('theme')} value={theme} onChange={e=>setTheme(e.target.value as Theme)}><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option><option value="system">{t('system')}</option></select></label></div>;
}