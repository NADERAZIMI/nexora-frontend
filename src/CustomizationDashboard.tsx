import React,{useEffect,useState} from 'react';
import './CustomizationDashboard.css';

export type DesignSettings={
 background:string;surface:string;chartBackground:string;elevated:string;text:string;muted:string;border:string;
 primary:string;hover:string;positive:string;negative:string;
 font:string;fontSize:number;headingSize:number;radius:number;density:number;chartHeight:number;
};
export const defaultDesign:DesignSettings={
 background:'#000000',surface:'#101014',chartBackground:'#101014',elevated:'#15191F',text:'#F4F6FA',muted:'#9BA5B5',
 border:'#29313D',primary:'#3378FF',hover:'#EAA343',positive:'#16B89A',negative:'#F05A70',
 font:'Inter',fontSize:12,headingSize:18,radius:4,density:8,chartHeight:600
};
export const designKey='nexora:design-customization:v1';
const colorFields:{id:keyof DesignSettings;label:string;description:string}[]=[
 {id:'background',label:'Main background',description:'Workspace and site canvas'},
 {id:'surface',label:'Panels',description:'Market and dashboard surfaces'},
 {id:'chartBackground',label:'Chart background',description:'MG candle canvas and chart surface'},
 {id:'elevated',label:'Elevated areas',description:'Popovers and input backgrounds'},
 {id:'text',label:'Primary text',description:'Headings, prices and labels'},
 {id:'muted',label:'Secondary text',description:'Descriptions and metadata'},
 {id:'border',label:'Borders',description:'Dividers and outlines'},
 {id:'primary',label:'Brand accent',description:'Selections and active buttons'},
 {id:'hover',label:'Hover accent',description:'Interactive highlights'},
 {id:'positive',label:'Positive movement',description:'Buy and price increases'},
 {id:'negative',label:'Negative movement',description:'Sell and price decreases'}
];
const isHex=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function loadDesign():DesignSettings{
 try{
  const raw=JSON.parse(localStorage.getItem(designKey)||'null') as Partial<DesignSettings>|null;
  if(!raw||typeof raw!=='object')return {...defaultDesign};
  const next={...defaultDesign};
  for(const {id} of colorFields)if(isHex(raw[id]))(next as unknown as Record<string,string>)[id]=raw[id] as string;
  if(['Inter','Arial','Roboto','Georgia','system-ui'].includes(raw.font||''))next.font=raw.font!;
  for(const [k,min,max] of [['fontSize',10,18],['headingSize',14,28],['radius',0,20],['density',4,18],['chartHeight',380,900]] as const){
   const n=raw[k];if(typeof n==='number'&&Number.isFinite(n))next[k]=Math.max(min,Math.min(max,n));
  }
  return next;
 }catch{return {...defaultDesign}}
}
export function applyDesign(settings:DesignSettings){
 const root=document.documentElement;
 const vars:Record<string,string>={
 '--nx-bg':settings.background,'--nx-surface':settings.surface,'--nx-chart-bg':settings.chartBackground,'--nx-elevated':settings.elevated,
 '--nx-text':settings.text,'--nx-muted':settings.muted,'--nx-border':settings.border,
 '--nx-blue':settings.primary,'--nx-blue-deep':settings.primary,'--nx-hover':settings.hover,
 '--nx-positive':settings.positive,'--nx-negative':settings.negative,
 '--nx-user-font-size':settings.fontSize+'px','--nx-user-heading-size':settings.headingSize+'px',
 '--nx-user-radius':settings.radius+'px','--nx-user-density':settings.density+'px',
 '--nx-user-chart-height':settings.chartHeight+'px'
 };
 for(const [key,value] of Object.entries(vars))root.style.setProperty(key,value);
 window.dispatchEvent(new Event('nexora:design-change'));
 root.style.setProperty('--nx-user-font',settings.font==='Inter'? "'Inter',system-ui,sans-serif":settings.font==='system-ui'?'system-ui,sans-serif':settings.font+',sans-serif');
 root.dataset.nxCustomized='true';
}
export function clearDesign(){
 const root=document.documentElement;
 for(const key of ['--nx-bg','--nx-surface','--nx-chart-bg','--nx-elevated','--nx-text','--nx-muted','--nx-border','--nx-blue','--nx-blue-deep','--nx-hover','--nx-positive','--nx-negative','--nx-user-font-size','--nx-user-heading-size','--nx-user-radius','--nx-user-density','--nx-user-chart-height','--nx-user-font'])root.style.removeProperty(key);
 delete root.dataset.nxCustomized;
 window.dispatchEvent(new Event('nexora:design-change'));
}
const presets=[
 {name:'NEXORA Original',primary:'#3378FF',hover:'#EAA343',background:'#000000',surface:'#101014'},
 {name:'Ocean',primary:'#06B6D4',hover:'#67E8F9',background:'#06131B',surface:'#101F2A'},
 {name:'Violet',primary:'#A78BFA',hover:'#D8B4FE',background:'#0B0815',surface:'#191326'},
 {name:'Emerald',primary:'#16B89A',hover:'#5EEAD4',background:'#07110F',surface:'#10201B'},
 {name:'Amber',primary:'#F59E0B',hover:'#FBBF24',background:'#10100C',surface:'#201C13'}
] as const;
export default function CustomizationDashboard(){
 const [draft,setDraft]=useState<DesignSettings>(loadDesign);
 const [saved,setSaved]=useState(false);
 const [section,setSection]=useState<'colors'|'typography'|'layout'>('colors');
 const change=<K extends keyof DesignSettings>(key:K,value:DesignSettings[K])=>{setDraft(prev=>({...prev,[key]:value}));setSaved(false)};
 useEffect(()=>{applyDesign(draft)},[draft]);
 const save=()=>{try{localStorage.setItem(designKey,JSON.stringify(draft));setSaved(true)}catch{setSaved(false)}};
 const reset=()=>{if(!window.confirm('Restore the original NEXORA appearance?'))return;localStorage.removeItem(designKey);const clean={...defaultDesign};setDraft(clean);setSaved(false);clearDesign();};
 return <main className="nx-custom-page">
  <div className="nx-custom-hero"><div><p className="nx-eyebrow">PERSONAL WORKSPACE</p><h1>Customize your NEXORA</h1><p>Choose your colors, typography and display preferences. Preview every change before saving.</p></div><div className="nx-custom-actions"><button type="button" className="nx-reset" onClick={reset}>Reset to original</button><button type="button" className="nx-save" onClick={save}>{saved?'✓ Saved':'Save preferences'}</button></div></div>
  <div className="nx-custom-layout">
   <aside className="nx-custom-sidebar"><strong>Appearance</strong>{(['colors','typography','layout'] as const).map(key=><button key={key} type="button" className={section===key?'active':''} onClick={()=>setSection(key)}>{key==='colors'?'◉  Color palette':key==='typography'?'T  Typography':'▤  Layout & sizing'}</button>)}<p>Your preferences are stored in this browser and can be reset at any time.</p></aside>
   <section className="nx-custom-editor">
    {section==='colors'&&<><h2>Color palette</h2><p className="nx-custom-muted">Customize each part of the interface independently.</p><div className="nx-presets">{presets.map(p=><button type="button" key={p.name} onClick={()=>setDraft(v=>({...v,primary:p.primary,hover:p.hover,background:p.background,surface:p.surface}))}><span style={{background:p.primary}}/>{p.name}</button>)}</div><div className="nx-colors">{colorFields.map(({id,label,description})=><label className="nx-color-row" key={id}><span><strong>{label}</strong><small>{description}</small></span><span className="nx-color-input"><input type="color" value={draft[id] as string} onChange={e=>change(id,e.target.value)}/><input aria-label={label+' hex'} value={draft[id] as string} onChange={e=>{if(isHex(e.target.value))change(id,e.target.value)}} maxLength={7}/></span></label>)}</div></>}
    {section==='typography'&&<><h2>Typography</h2><p className="nx-custom-muted">Pick a font and sizes that feel comfortable.</p><label className="nx-setting-row">Font family<select value={draft.font} onChange={e=>change('font',e.target.value)}>{['Inter','Arial','Roboto','Georgia','system-ui'].map(f=><option key={f} value={f}>{f}</option>)}</select></label><SettingSlider label="Base font size" value={draft.fontSize} min={10} max={18} unit="px" onChange={v=>change('fontSize',v)}/><SettingSlider label="Heading size" value={draft.headingSize} min={14} max={28} unit="px" onChange={v=>change('headingSize',v)}/></>}
    {section==='layout'&&<><h2>Layout and sizing</h2><p className="nx-custom-muted">Tune spacing and dimensions without changing market data.</p><SettingSlider label="Corner radius" value={draft.radius} min={0} max={20} unit="px" onChange={v=>change('radius',v)}/><SettingSlider label="Component spacing" value={draft.density} min={4} max={18} unit="px" onChange={v=>change('density',v)}/><SettingSlider label="Preferred chart height" value={draft.chartHeight} min={380} max={900} unit="px" onChange={v=>change('chartHeight',v)}/></>}
   </section>
   <aside className="nx-custom-preview"><div className="nx-preview-head"><strong>Live preview</strong><span>Preview only</span></div><div className="nx-preview-market"><small>BTC / USDT</small><strong>82,768.40</strong><span>+2.48%</span></div><div className="nx-preview-chart"><div className="nx-preview-chart-tools"><span>1m</span><span className="active">5m</span><span>15m</span><span>1H</span></div><svg viewBox="0 0 320 150" preserveAspectRatio="none" aria-label="Illustrative chart preview"><path d="M0 110 L28 95 L49 107 L68 70 L90 79 L112 56 L132 73 L155 48 L182 59 L207 37 L227 45 L256 22 L279 39 L320 16" fill="none" stroke={draft.positive} strokeWidth="2.4"/><path d="M0 110 L28 95 L49 107 L68 70 L90 79 L112 56 L132 73 L155 48 L182 59 L207 37 L227 45 L256 22 L279 39 L320 16 L320 150 L0 150Z" fill={draft.positive} opacity=".08"/></svg></div><div className="nx-preview-buttons"><button>Buy BTC</button><button>Sell BTC</button></div><p className="nx-custom-muted">Colors and typography are applied live to the page. Saved settings persist after refresh.</p></aside>
  </div>
 </main>;
}
function SettingSlider({label,value,min,max,unit,onChange}:{label:string;value:number;min:number;max:number;unit:string;onChange:(n:number)=>void}){return <label className="nx-setting-row"><span>{label}<strong>{value}{unit}</strong></span><input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}
