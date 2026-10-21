import {useEffect,useRef,useState} from 'react';
import './ChartAlerts.css';
type Condition='crosses'|'above'|'below';
type Tone='none'|'bell'|'chime'|'double'|'pulse';
type Source='price'|'ema';
function playTone(tone:Tone){if(tone==='none')return;try{const Context=window.AudioContext;const ctx=new Context();const sequences:Record<Exclude<Tone,'none'>,number[]>={bell:[880],chime:[660,880,1100],double:[880,880],pulse:[520,640,780,960]};(sequences[tone]||[]).forEach((frequency,i)=>{const oscillator=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.19;oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.08,start+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+.16);oscillator.connect(gain).connect(ctx.destination);oscillator.start(start);oscillator.stop(start+.17)});window.setTimeout(()=>void ctx.close(),1800)}catch{}}

type AlertItem={id:string;price:number;source?:Source;emaPeriod?:number;emaInterval?:string;tone?:Tone;condition:Condition;repeat:boolean;enabled:boolean;note:string;created:number;lastTriggered?:number;triggered?:boolean};
const key=(symbol:string)=>'nexora:price-alerts:v2:'+symbol;
const load=(symbol:string):AlertItem[]=>{try{const x=JSON.parse(localStorage.getItem(key(symbol))||'[]');return Array.isArray(x)?x.filter(a=>Number.isFinite(a.price)&&a.price>0&&typeof a.id==='string'):[]}catch{return []}};
const format=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:8});
export default function ChartAlerts({symbol,livePrice,onClose,open}:{symbol:string;livePrice:number|null;onClose:()=>void;open:boolean}){
 const [items,setItems]=useState<AlertItem[]>(()=>load(symbol));
 const [price,setPrice]=useState('');
 const [source,setSource]=useState<Source>('price');
 const [emaPeriod,setEmaPeriod]=useState(20);
 const [emaInterval,setEmaInterval]=useState('15');
 const [tone,setTone]=useState<Tone>('bell');
 const [emaValue,setEmaValue]=useState<number|null>(null);
 const [condition,setCondition]=useState<Condition>('crosses');
 const [repeat,setRepeat]=useState(false);
 const [note,setNote]=useState('');
 const [editId,setEditId]=useState<string|null>(null);
 const [section,setSection]=useState<'active'|'history'>('active');
 const [message,setMessage]=useState('');
 const previous=useRef<number|null>(null);
 const emaValues=useRef(new Map<string,number>());
 useEffect(()=>{let cancelled=false;const refresh=async()=>{const configs=Array.from(new Set(items.filter(a=>a.enabled&&a.source==='ema').map(a=>(a.emaInterval||'15')+':'+(a.emaPeriod||20)).concat(source==='ema'?[emaInterval+':'+emaPeriod]:[])));for(const config of configs){const [interval,p]=config.split(':'),period=Number(p);try{const response=await fetch('https://api.bybit.com/v5/market/kline?'+new URLSearchParams({category:'spot',symbol,interval,limit:String(Math.min(1000,Math.max(120,period*5)))}));const json=await response.json() as {retCode?:number;result?:{list?:string[][]}};if(json.retCode!==0||!Array.isArray(json.result?.list))continue;const closes=json.result.list.map(row=>Number(row[4])).reverse().filter(Number.isFinite);if(closes.length<period)continue;let value=closes.slice(0,period).reduce((a,b)=>a+b,0)/period;const k=2/(period+1);for(const close of closes.slice(period))value=close*k+value*(1-k);if(!cancelled){emaValues.current.set(config,value);if(config===emaInterval+':'+emaPeriod)setEmaValue(value)}}catch{}}};void refresh();const timer=window.setInterval(()=>void refresh(),15000);return()=>{cancelled=true;window.clearInterval(timer)}},[symbol,source,emaInterval,emaPeriod,items.length]);
 const lastPair=useRef(symbol);
 useEffect(()=>{setItems(load(symbol));previous.current=null;lastPair.current=symbol;setEditId(null);setPrice('');setMessage('')},[symbol]);
 useEffect(()=>{try{localStorage.setItem(key(symbol),JSON.stringify(items))}catch{}},[items,symbol]);
 useEffect(()=>{
  if(livePrice===null||!Number.isFinite(livePrice)||livePrice<=0)return;
  const old=previous.current;previous.current=livePrice;
  if(old===null)return;
  const now=Date.now();
  setItems(current=>{
   let changed=false;
   const updated=current.map(item=>{
    if(!item.enabled)return item;
    const target=item.source==='ema'?emaValues.current.get((item.emaInterval||'15')+':'+(item.emaPeriod||20)):item.price;
    if(target===undefined)return item;
    const crossed=(old<target&&livePrice>=target)||(old>target&&livePrice<=target);
    const hit=item.condition==='crosses'?crossed:item.condition==='above'?old<=target&&livePrice>target:old>=target&&livePrice<target;
    if(!hit||now-(item.lastTriggered||0)<10000)return item;
    changed=true;
    playTone(item.tone||'bell');
    return {...item,lastTriggered:now,triggered:true,enabled:item.repeat};
   });
   if(changed){setMessage('Price alert triggered at '+format(livePrice));return updated}
   return current;
  });
 },[livePrice]);
 const save=()=>{
  const n=source==='ema'?0:Number(price);
  if(source==='ema'&&(!Number.isInteger(emaPeriod)||emaPeriod<2||emaPeriod>500)){setMessage('EMA period must be between 2 and 500.');return}
  if(!Number.isFinite(n)||n<0||(source==='price'&&n===0)){setMessage('Enter a valid positive target price.');return}
  const now=Date.now();
  setItems(old=>editId?old.map(x=>x.id===editId?{...x,price:n,source,emaPeriod,emaInterval,tone,condition,repeat,note,enabled:true,triggered:false,lastTriggered:undefined}:x):[{id:String(now)+'-'+Math.random().toString(36).slice(2,7),price:n,source,emaPeriod,emaInterval,tone,condition,repeat,note,created:now,enabled:true},...old]);
  setPrice('');setNote('');setEditId(null);setMessage('Alert saved for this browser.');
 };
 const edit=(item:AlertItem)=>{setPrice(item.source==='ema'?'':String(item.price));setSource(item.source||'price');setEmaPeriod(item.emaPeriod||20);setEmaInterval(item.emaInterval||'15');setTone(item.tone||'bell');setCondition(item.condition);setRepeat(item.repeat);setNote(item.note||'');setEditId(item.id);setSection('active')};
 const current=items.filter(a=>section==='active'?!a.triggered||a.enabled:!!a.triggered);
 return <section className="nx-alert-panel" style={{display:open?undefined:"none"}} role="dialog" aria-label="Price alerts">
  <header><div><strong>Price Alerts</strong><small>{symbol} · {livePrice!==null?format(livePrice):'Waiting for price'}</small></div><button type="button" aria-label="Close alerts" onClick={onClose}>×</button></header>
  <div className="nx-alert-scroll">
   <div className="nx-alert-block"><label>Alert on</label><select value={source} onChange={e=>setSource(e.target.value as Source)}><option value="price">Price</option><option value="ema">EMA · Price crossing moving average</option></select>{source==='ema'&&<><label>EMA period</label><input type="number" min="2" max="500" value={emaPeriod} onChange={e=>setEmaPeriod(Number(e.target.value))}/><label>EMA timeframe</label><select value={emaInterval} onChange={e=>setEmaInterval(e.target.value)}>{[['1','1 minute'],['5','5 minutes'],['15','15 minutes'],['60','1 hour'],['240','4 hours'],['D','1 day']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small>Current EMA: {emaValue===null?'Loading…':format(emaValue)}</small></>}
    <label>Condition</label><select value={condition} onChange={e=>setCondition(e.target.value as Condition)}><option value="crosses">Price crosses</option><option value="above">Price crosses above</option><option value="below">Price crosses below</option></select>
    {source==='price'&&<><label>Target price</label><div className="nx-alert-price"><input type="number" min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Enter price"/><span>{symbol.endsWith('USDT')?'USDT':symbol.endsWith('USDC')?'USDC':''}</span></div></>}
    <label>Notification sound</label><div className="nx-alert-sound"><select value={tone} onChange={e=>setTone(e.target.value as Tone)}>{(['none','bell','chime','double','pulse'] as Tone[]).map(t=><option key={t} value={t}>{t==='none'?'Silent':t==='bell'?'Bell':t==='chime'?'Chime':t==='double'?'Double bell':'Pulse'}</option>)}</select><button type="button" onClick={()=>playTone(tone)}>▶ Preview</button></div>
    <label>Message (optional)</label><input type="text" maxLength={120} value={note} onChange={e=>setNote(e.target.value)} placeholder="Note for this alert"/>
    <label className="nx-alert-repeat"><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/> Repeat whenever condition is crossed</label>
    <div className="nx-alert-actions"><button type="button" onClick={save}>{editId?'Update alert':'+ Create alert'}</button>{editId&&<button type="button" onClick={()=>{setEditId(null);setPrice('');setNote('')}}>Cancel</button>}</div>
   </div>
   <div className="nx-alert-tabs"><button className={section==='active'?'selected':''} onClick={()=>setSection('active')}>Alerts ({items.filter(a=>!a.triggered||a.enabled).length})</button><button className={section==='history'?'selected':''} onClick={()=>setSection('history')}>Triggered ({items.filter(a=>a.triggered).length})</button></div>
   <div className="nx-alert-list">{current.length?current.map(item=><div className="nx-alert-item" key={item.id}><div><strong>{item.source==='ema'?'EMA '+(item.emaPeriod||20)+' · '+(item.emaInterval||'15'):format(item.price)}</strong><small>{item.condition==='crosses'?'Crossing':item.condition==='above'?'Crossing up':'Crossing down'} · {item.repeat?'Repeating':'Once'}{item.lastTriggered?' · Triggered':''}</small>{item.note&&<small>{item.note}</small>}</div><div className="nx-alert-item-actions"><button type="button" title="Edit" onClick={()=>edit(item)}>✎</button><button type="button" title={item.enabled?'Pause':'Resume'} onClick={()=>setItems(x=>x.map(a=>a.id===item.id?{...a,enabled:!a.enabled,triggered:false}:a))}>{item.enabled?'Ⅱ':'▶'}</button><button type="button" title="Delete" onClick={()=>setItems(x=>x.filter(a=>a.id!==item.id))}>×</button></div></div>):<p className="nx-alert-empty">No {section==='active'?'active':'triggered'} alerts</p>}</div>
   {message&&<p className="nx-alert-notice" role="status">{message}</p>}
   <p className="nx-alert-disclaimer">Alerts work while this trading page is open and live prices are received. They are stored in this browser, not on a notification server.</p>
  </div>
 </section>;
}
