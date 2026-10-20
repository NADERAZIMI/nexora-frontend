/** Approved KLineChart v10 integrated into Spot. No trade/account endpoints. */
type Bar={timestamp:number;open:number;high:number;low:number;close:number;volume:number};
type KChart={setSymbol:(s:object)=>void;setPeriod:(p:object)=>void;setDataLoader:(d:object)=>void;createIndicator:(name:string)=>unknown;removeIndicator?:(name:string)=>void;dispose?:()=>void;resize?:()=>void};
type KLib={init:(node:HTMLElement,options:object)=>KChart|null;dispose?:(node:HTMLElement)=>void};
declare global {interface Window {klinecharts?:KLib}}
const periods:Record<string,{span:number;type:string;api:string}>={
 '1m':{span:1,type:'minute',api:'1'},'5m':{span:5,type:'minute',api:'5'},
 '15m':{span:15,type:'minute',api:'15'},'30m':{span:30,type:'minute',api:'30'},
 '1H':{span:1,type:'hour',api:'60'},'4H':{span:4,type:'hour',api:'240'},
 '1D':{span:1,type:'day',api:'D'},'1W':{span:1,type:'week',api:'W'},'1M':{span:1,type:'month',api:'M'}
};
const libraryUrl='https://cdn.jsdelivr.net/npm/klinecharts@10.1.0/dist/umd/klinecharts.min.js';
let libraryPromise:Promise<KLib>|undefined;
function loadLibrary():Promise<KLib>{
 if(window.klinecharts?.init)return Promise.resolve(window.klinecharts);
 if(!libraryPromise)libraryPromise=new Promise<KLib>((resolve,reject)=>{
  const script=document.createElement('script');script.src=libraryUrl;script.async=true;script.crossOrigin='anonymous';
  script.onload=()=>window.klinecharts?.init?resolve(window.klinecharts):reject(new Error('KLineChart unavailable'));
  script.onerror=()=>reject(new Error('KLineChart CDN unavailable'));document.head.append(script);
 }).catch(error=>{libraryPromise=undefined;throw error});
 return libraryPromise!;
}
export function attachSpotKlineChart(wrapper:HTMLElement,root:HTMLElement):()=>void{
 const overlay=document.createElement('section');overlay.className='nexora-kline-panel';
 const toolbar=document.createElement('div');toolbar.className='nexora-kline-toolbar';
 const status=document.createElement('div');status.className='nexora-kline-status';status.setAttribute('role','status');
 const canvas=document.createElement('div');canvas.className='nexora-kline-canvas';
 const timeframe=document.createElement('select');timeframe.setAttribute('aria-label','Chart timeframe');
 for(const label of Object.keys(periods)){const option=document.createElement('option');option.value=label;option.textContent=label;option.selected=label==='15m';timeframe.append(option)}
 toolbar.append(timeframe);
 const switches=new Map<string,HTMLButtonElement>();
 for(const name of ['MA','EMA','VOL']){
  const button=document.createElement('button');button.type='button';button.textContent=name;button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>toggle(name));toolbar.append(button);switches.set(name,button);
 }
 overlay.append(toolbar,canvas,status);wrapper.append(overlay);
 let instance:KChart|null=null,disposed=false,symbol='BTCUSDT',generation=0,abort:AbortController|null=null;
 const active=new Set<string>();
 const setStatus=(text:string,error=false)=>{status.textContent=text;status.dataset.error=String(error)};
 function toggle(name:string){
  if(!instance)return;
  try{
   if(active.has(name)){instance.removeIndicator?.(name);active.delete(name)}
   else{instance.createIndicator(name);active.add(name)}
   switches.get(name)?.setAttribute('aria-pressed',String(active.has(name)));
  }catch(err){setStatus('Indicator unavailable: '+(err instanceof Error?err.message:String(err)),true)}
 }
 const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Z0-9]{3,30}$/.test(v);
 const parseBars=(data:unknown):Bar[]=>{
  if(!data||typeof data!=='object')throw Error('Invalid market response');
  const v=data as {retCode?:number;result?:{list?:unknown[]}};
  if(v.retCode!==0||!Array.isArray(v.result?.list))throw Error('No public candles returned');
  return v.result.list.filter(Array.isArray).map(row=>({
   timestamp:Number(row[0]),open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4]),volume:Number(row[5])
  })).filter(b=>Object.values(b).every(Number.isFinite)&&b.timestamp>0&&b.low>0&&b.high>=b.low&&b.open>0&&b.close>0).sort((a,b)=>a.timestamp-b.timestamp);
 };
 const load=()=>{
  if(!instance||disposed)return;
  generation++;abort?.abort();abort=new AbortController();
  const run=generation,nextSymbol=symbol,nextPeriod=timeframe.value,signal=abort.signal;
  setStatus('Loading '+symbol+' · '+nextPeriod+' candles…');
  try{
   instance.setSymbol({ticker:nextSymbol,pricePrecision:8,volumePrecision:4});
   instance.setPeriod(periods[nextPeriod]);
  }catch(err){setStatus('Chart configuration failed: '+String(err),true)}
 };
 const init=async()=>{
  try{
   const lib=await loadLibrary();if(disposed)return;
   instance=lib.init(canvas,{locale:'en-US',styles:'dark',timezone:'UTC'});
   if(!instance)throw Error('KLineChart initialization failed');
   instance.setDataLoader({getBars:async({callback}:{callback:(bars:Bar[],more:boolean)=>void})=>{
    const requestedSymbol=symbol,requestedPeriod=timeframe.value,requestedGeneration=generation;
    const query=new URLSearchParams({category:'spot',symbol:requestedSymbol,interval:periods[requestedPeriod].api,limit:'500'});
    try{
     // Read-only public REST endpoint. A failed request never displays fabricated candles.
     const response=await fetch('https://api.bybit.com/v5/market/kline?'+query.toString(),{credentials:'omit',cache:'no-store',signal:abort?.signal});
     if(!response.ok)throw Error('HTTP '+response.status);
     const bars=parseBars(await response.json());
     if(disposed||requestedGeneration!==generation){callback([],false);return}
     callback(bars,false);setStatus(bars.length+' real '+requestedSymbol+' candles · '+requestedPeriod+' · Bybit Spot');
    }catch(err){
     callback([],false);
     if(!disposed&&requestedGeneration===generation&&!(err instanceof DOMException&&err.name==='AbortError'))
      setStatus('Unable to load Bybit candles: '+(err instanceof Error?err.message:String(err)),true);
    }
   }});
   load();
  }catch(err){if(!disposed)setStatus(err instanceof Error?err.message:String(err),true)}
 };
 const market=(e:Event)=>{const d=(e as CustomEvent<{symbol?:string;category?:string}>).detail;
  if(d?.category&&d.category!=='spot')return;
  if(!valid(d?.symbol))return;symbol=d.symbol;load();
 };
 const periodChanged=()=>load();
 timeframe.addEventListener('change',periodChanged);root.addEventListener('nexora:market-selected',market);
 void init();
 return()=>{disposed=true;generation++;abort?.abort();root.removeEventListener('nexora:market-selected',market);timeframe.removeEventListener('change',periodChanged);try{instance?.dispose?.();window.klinecharts?.dispose?.(canvas)}catch{}overlay.remove()};
}
