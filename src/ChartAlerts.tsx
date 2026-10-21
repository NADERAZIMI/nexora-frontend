import {useEffect,useRef,useState} from 'react';
import './ChartAlerts.css';
type Condition='crosses'|'above'|'below';
type AlertItem={id:string;price:number;condition:Condition;repeat:boolean;enabled:boolean;note:string;created:number;lastTriggered?:number;triggered?:boolean};
const key=(symbol:string)=>'nexora:price-alerts:v2:'+symbol;
const load=(symbol:string):AlertItem[]=>{try{const x=JSON.parse(localStorage.getItem(key(symbol))||'[]');return Array.isArray(x)?x.filter(a=>Number.isFinite(a.price)&&a.price>0&&typeof a.id==='string'):[]}catch{return []}};
const format=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:8});
export default function ChartAlerts({symbol,livePrice,onClose}:{symbol:string;livePrice:number|null;onClose:()=>void}){
 const [items,setItems]=useState<AlertItem[]>(()=>load(symbol));
 const [price,setPrice]=useState('');
 const [condition,setCondition]=useState<Condition>('crosses');
 const [repeat,setRepeat]=useState(false);
 const [note,setNote]=useState('');
 const [editId,setEditId]=useState<string|null>(null);
 const [section,setSection]=useState<'active'|'history'>('active');
 const [message,setMessage]=useState('');
 const previous=useRef<number|null>(null);
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
    const crossed=(old<item.price&&livePrice>=item.price)||(old>item.price&&livePrice<=item.price);
    const hit=item.condition==='crosses'?crossed:item.condition==='above'?old<=item.price&&livePrice>item.price:old>=item.price&&livePrice<item.price;
    if(!hit||now-(item.lastTriggered||0)<10000)return item;
    changed=true;
    return {...item,lastTriggered:now,triggered:true,enabled:item.repeat};
   });
   if(changed){setMessage('Price alert triggered at '+format(livePrice));return updated}
   return current;
  });
 },[livePrice]);
 const save=()=>{
  const n=Number(price);
  if(!Number.isFinite(n)||n<=0){setMessage('Enter a valid positive target price.');return}
  const now=Date.now();
  setItems(old=>editId?old.map(x=>x.id===editId?{...x,price:n,condition,repeat,note,enabled:true,triggered:false,lastTriggered:undefined}:x):[{id:String(now)+'-'+Math.random().toString(36).slice(2,7),price:n,condition,repeat,note,created:now,enabled:true},...old]);
  setPrice('');setNote('');setEditId(null);setMessage('Alert saved for this browser.');
 };
 const edit=(item:AlertItem)=>{setPrice(String(item.price));setCondition(item.condition);setRepeat(item.repeat);setNote(item.note||'');setEditId(item.id);setSection('active')};
 const current=items.filter(a=>section==='active'?!a.triggered||a.enabled:!!a.triggered);
 return <section className="nx-alert-panel" role="dialog" aria-label="Price alerts">
  <header><div><strong>Price Alerts</strong><small>{symbol} · {livePrice!==null?format(livePrice):'Waiting for price'}</small></div><button type="button" aria-label="Close alerts" onClick={onClose}>×</button></header>
  <div className="nx-alert-scroll">
   <div className="nx-alert-block"><label>Condition</label><select value={condition} onChange={e=>setCondition(e.target.value as Condition)}><option value="crosses">Price crosses</option><option value="above">Price crosses above</option><option value="below">Price crosses below</option></select>
    <label>Target price</label><div className="nx-alert-price"><input type="number" min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Enter price"/><span>{symbol.endsWith('USDT')?'USDT':symbol.endsWith('USDC')?'USDC':''}</span></div>
    <label>Message (optional)</label><input type="text" maxLength={120} value={note} onChange={e=>setNote(e.target.value)} placeholder="Note for this alert"/>
    <label className="nx-alert-repeat"><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/> Repeat whenever condition is crossed</label>
    <div className="nx-alert-actions"><button type="button" onClick={save}>{editId?'Update alert':'+ Create alert'}</button>{editId&&<button type="button" onClick={()=>{setEditId(null);setPrice('');setNote('')}}>Cancel</button>}</div>
   </div>
   <div className="nx-alert-tabs"><button className={section==='active'?'selected':''} onClick={()=>setSection('active')}>Alerts ({items.filter(a=>!a.triggered||a.enabled).length})</button><button className={section==='history'?'selected':''} onClick={()=>setSection('history')}>Triggered ({items.filter(a=>a.triggered).length})</button></div>
   <div className="nx-alert-list">{current.length?current.map(item=><div className="nx-alert-item" key={item.id}><div><strong>{format(item.price)}</strong><small>{item.condition==='crosses'?'Crossing':item.condition==='above'?'Crossing up':'Crossing down'} · {item.repeat?'Repeating':'Once'}{item.lastTriggered?' · Triggered':''}</small>{item.note&&<small>{item.note}</small>}</div><div className="nx-alert-item-actions"><button type="button" title="Edit" onClick={()=>edit(item)}>✎</button><button type="button" title={item.enabled?'Pause':'Resume'} onClick={()=>setItems(x=>x.map(a=>a.id===item.id?{...a,enabled:!a.enabled,triggered:false}:a))}>{item.enabled?'Ⅱ':'▶'}</button><button type="button" title="Delete" onClick={()=>setItems(x=>x.filter(a=>a.id!==item.id))}>×</button></div></div>):<p className="nx-alert-empty">No {section==='active'?'active':'triggered'} alerts</p>}</div>
   {message&&<p className="nx-alert-notice" role="status">{message}</p>}
   <p className="nx-alert-disclaimer">Alerts work while this trading page is open and live prices are received. They are stored in this browser, not on a notification server.</p>
  </div>
 </section>;
}
