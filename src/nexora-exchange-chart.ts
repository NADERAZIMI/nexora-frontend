/** NEXORA exchange chart: open-source Lightweight Charts with public Bybit Spot OHLCV. */
type Bar={time:number;open:number;high:number;low:number;close:number;volume:number};
type Series={setData:(bars:unknown[])=>void;update:(bar:unknown)=>void;createPriceLine?:(opts:object)=>unknown;removePriceLine?:(line:unknown)=>void;coordinateToPrice?:(coordinate:number)=>number|null;priceScale?:(id?:string)=>{applyOptions:(opts:object)=>void}};
type Chart={addSeries:(type:unknown,opts?:object,paneIndex?:number)=>Series;removeSeries:(s:Series)=>void;timeScale:()=>{fitContent:()=>void};applyOptions:(opts:object)=>void;remove:()=>void;subscribeClick?:(callback:(param:{point?:{x:number;y:number}})=>void)=>void;unsubscribeClick?:(callback:(param:{point?:{x:number;y:number}})=>void)=>void};
type Lib={createChart:(node:HTMLElement,opts:object)=>Chart;CandlestickSeries:unknown;HistogramSeries:unknown;LineSeries:unknown};
declare global{interface Window{LightweightCharts?:Lib}}
const sources=['https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.9/dist/lightweight-charts.standalone.production.js','https://unpkg.com/lightweight-charts@5.0.9/dist/lightweight-charts.standalone.production.js'];
let scriptPromise:Promise<Lib>|undefined;
function library():Promise<Lib>{
 if(window.LightweightCharts?.createChart)return Promise.resolve(window.LightweightCharts);
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  let index=0;
  const next=()=>{
   if(index>=sources.length){reject(Error('All chart CDN sources unavailable'));return}
   const s=document.createElement('script');s.src=sources[index++];s.async=true;s.crossOrigin='anonymous';
   s.onload=()=>{if(window.LightweightCharts?.createChart)resolve(window.LightweightCharts);else{s.remove();next()}};
   s.onerror=()=>{s.remove();next()};document.head.append(s);
  };next();
 }).catch(err=>{scriptPromise=undefined;throw err});
 return scriptPromise;
}
const frames:Record<string,string>={'1m':'1','3m':'3','5m':'5','15m':'15','30m':'30','1h':'60','4h':'240','1d':'D','1w':'W','1M':'M'};
function average(bars:Bar[],length:number,exponential:boolean){
 const out:{time:number;value:number}[]=[];let ema=0,sum=0;
 for(let i=0;i<bars.length;i++){sum+=bars[i].close;if(i>=length)sum-=bars[i-length].close;
  if(i===length-1)ema=sum/length;
  if(i>=length){if(exponential)ema=bars[i].close*(2/(length+1))+ema*(1-2/(length+1));out.push({time:bars[i].time,value:exponential?ema:sum/length})}
  else if(i===length-1)out.push({time:bars[i].time,value:ema});
 }
 return out;
}
export function attachNexoraExchangeChart(wrapper:HTMLElement,root:HTMLElement):()=>void{
 const host=document.createElement('div');host.className='nexora-exchange-chart';host.setAttribute('data-nexora-chart','lightweight');
 const tools=document.createElement('div');tools.className='nexora-exchange-toolbar';
 const side=document.createElement('div');side.className='nexora-exchange-side';
 const plot=document.createElement('div');plot.className='nexora-exchange-plot';
 const foot=document.createElement('div');foot.className='nexora-exchange-foot';
 foot.textContent='Powered by TradingView Lightweight Charts · Public Bybit Spot data';
 const status=document.createElement('span');status.className='nexora-exchange-status';status.setAttribute('role','status');
 const frame=document.createElement('select');frame.setAttribute('aria-label','Chart timeframe');
 for(const key of Object.keys(frames)){const opt=document.createElement('option');opt.value=key;opt.textContent=key;opt.selected=key==='1h';frame.append(opt)}
 tools.append(frame);
 const toggles=new Map<string,HTMLButtonElement>();
 for(const name of ['EMA 50','MA 20','Volume']){
  const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(name==='Volume'));
  b.addEventListener('click',()=>{if(visible.has(name))visible.delete(name);else visible.add(name);b.setAttribute('aria-pressed',String(visible.has(name)));paint()});
  tools.append(b);toggles.set(name,b);
 }
 const fit=document.createElement('button');fit.type='button';fit.textContent='Fit';fit.title='Fit all available candles';tools.append(fit);
 const full=document.createElement('button');full.type='button';full.textContent='⛶';full.title='Toggle fullscreen';tools.append(full);
 const draw=document.createElement('button');draw.type='button';draw.textContent='Horizontal line';draw.setAttribute('aria-pressed','false');
 side.append(draw);
 const clear=document.createElement('button');clear.type='button';clear.textContent='Clear lines';side.append(clear);
 const shell=document.createElement('div');shell.className='nexora-exchange-body';shell.append(side,plot);
 host.append(tools,shell,status,foot);wrapper.append(host);
 let disposed=false,symbol='BTCUSDT',chart:Chart|null=null,candles:Series|null=null,volume:Series|null=null;
 let ma:Series|null=null,ema:Series|null=null,ws:WebSocket|null=null,retry:number|undefined,abort:AbortController|null=null,job=0;
 let data:Bar[]=[],lineMode=false,priceLines:unknown[]=[];
 const visible=new Set(['Volume']);
 const message=(s:string,error=false)=>{status.textContent=s;status.dataset.error=String(error)};
 const paint=()=>{
  if(!chart||!data.length)return;
  if(visible.has('Volume')){
   if(!volume)volume=chart.addSeries(window.LightweightCharts!.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',lastValueVisible:false,priceLineVisible:false});
   volume.setData(data.map(b=>({time:b.time,value:b.volume,color:b.close>=b.open?'#16b89a70':'#f05a7070'})));
   volume.priceScale?.('volume')?.applyOptions({scaleMargins:{top:0.82,bottom:0}});
  }else if(volume){chart.removeSeries(volume);volume=null}
  for(const [name,length,color,expo] of [['MA 20',20,'#3d6bff',false],['EMA 50',50,'#e3a044',true]] as const){
   let series=name==='MA 20'?ma:ema;
   if(visible.has(name)){
    if(!series)series=chart.addSeries(window.LightweightCharts!.LineSeries,{color,lineWidth:2,lastValueVisible:true,priceLineVisible:false});
    series.setData(average(data,length,expo));
    if(name==='MA 20')ma=series;else ema=series;
   }else if(series){chart.removeSeries(series);if(name==='MA 20')ma=null;else ema=null}
  }
 };
 const openSocket=()=>{
  if(ws){ws.onclose=null;ws.close();ws=null}
  if(retry!==undefined){clearTimeout(retry);retry=undefined}
  if(disposed||!chart||!candles)return;
  const current=ws=new WebSocket('wss://stream.bybit.com/v5/public/spot');
  const thisSymbol=symbol,thisFrame=frames[frame.value],thisJob=job;
  current.onopen=()=>{if(ws===current)current.send(JSON.stringify({op:'subscribe',args:['kline.'+thisFrame+'.'+thisSymbol]}))};
  current.onmessage=(event:MessageEvent)=>{if(disposed||ws!==current||thisJob!==job)return;
   try{const msg=JSON.parse(String(event.data)) as {topic?:string;data?:Array<{start:number;open:string;high:string;low:string;close:string;volume:string}>};
    if(msg.topic!=='kline.'+thisFrame+'.'+thisSymbol||!Array.isArray(msg.data))return;
    for(const x of msg.data){const b={time:Math.floor(Number(x.start)/1000),open:Number(x.open),high:Number(x.high),low:Number(x.low),close:Number(x.close),volume:Number(x.volume)};
     if(!Object.values(b).every(Number.isFinite)||b.low<=0||b.high<b.low)continue;
     const last=data[data.length-1];
     if(last&&b.time<last.time)continue;
     if(last&&b.time===last.time)data[data.length-1]=b;else data.push(b);
     candles!.update(b);if(volume&&visible.has('Volume'))volume.update({time:b.time,value:b.volume,color:b.close>=b.open?'#16b89a70':'#f05a7070'});
    }
    paint();if(data.length>0)message(symbol+' · '+frame.value+' · Live ('+data.length+' candles)');
   }catch{/* Ignore malformed public messages. */}
  };
  current.onclose=()=>{if(!disposed&&ws===current&&thisJob===job){ws=null;retry=window.setTimeout(openSocket,3000)}};
  current.onerror=()=>{if(ws===current)message('Public stream reconnecting…',true)};
 };
 const load=async()=>{
  const sequence=++job;abort?.abort();abort=new AbortController();
  if(ws){ws.onclose=null;ws.close();ws=null}
  if(retry!==undefined)clearTimeout(retry);
  data=[];candles?.setData([]);volume?.setData([]);ma?.setData([]);ema?.setData([]);
  message('Loading '+symbol+' · '+frame.value+' historical candles…');
  const qs=new URLSearchParams({category:'spot',symbol,interval:frames[frame.value],limit:'1000'});
  try{
   // The local dev proxy is preferred. Production can use an Nginx same-origin
   // location; direct Bybit REST is a fallback where browser CORS is permitted.
   const endpoints=['/bybit-public/v5/market/kline?'+qs,'https://api.bybit.com/v5/market/kline?'+qs];
   let result:{retCode:number;result?:{list?:string[][]}}|null=null;
   let lastError:unknown;
   for(const endpoint of endpoints){
    try{
     const response=await fetch(endpoint,{credentials:'omit',cache:'no-store',signal:abort.signal});
     if(!response.ok)throw Error('HTTP '+response.status);
     const payload=await response.json() as {retCode:number;result?:{list?:string[][]}};
     if(payload.retCode!==0||!Array.isArray(payload.result?.list))throw Error('Invalid candle payload');
     result=payload;break;
    }catch(err){if(abort.signal.aborted)throw err;lastError=err}
   }
   if(!result)throw lastError instanceof Error?lastError:Error('No working public candle endpoint');
   if(result.retCode!==0||!Array.isArray(result.result?.list))throw Error('Invalid OHLCV response');
   const bars=result.result.list.map(x=>({time:Math.floor(Number(x[0])/1000),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5])}))
    .filter(b=>Object.values(b).every(Number.isFinite)&&b.time>0&&b.low>0&&b.high>=b.low&&b.open>0&&b.close>0)
    .sort((a,b)=>a.time-b.time);
   if(disposed||job!==sequence)return;
   if(!bars.length)throw Error('No market candles available');
   data=bars;candles?.setData(data);paint();chart?.timeScale().fitContent();message(symbol+' · '+frame.value+' · '+bars.length+' historical candles');
   openSocket();
  }catch(err){if(disposed||job!==sequence)return;message('Historical candles unavailable; waiting for live Bybit candles. '+(err instanceof Error?err.message:String(err)),true);openSocket()}
 };
 const observer=new ResizeObserver(()=>{if(chart&&plot.clientWidth&&plot.clientHeight)chart.applyOptions({width:plot.clientWidth,height:plot.clientHeight})});
 const mount=async()=>{
  try{
   const lib=await library();if(disposed)return;
   chart=lib.createChart(plot,{autoSize:true,layout:{background:{type:'solid',color:'#121212'},textColor:'#929aaa',fontFamily:'Arial'},grid:{vertLines:{color:'#24262c'},horzLines:{color:'#24262c'}},crosshair:{mode:0},timeScale:{timeVisible:true,secondsVisible:false,borderColor:'#30343e'},rightPriceScale:{borderColor:'#30343e'},localization:{locale:'en-US'}});
   candles=chart.addSeries(lib.CandlestickSeries,{upColor:'#16b89a',downColor:'#f05a70',borderVisible:false,wickUpColor:'#16b89a',wickDownColor:'#f05a70'});
   observer.observe(plot);registerClick();await load();
  }catch(err){if(!disposed)message('Chart initialization failed: '+String(err),true)}
 };
 const market=(e:Event)=>{const d=(e as CustomEvent<{symbol?:string;category?:string}>).detail;
  if(d?.category&&d.category!=='spot')return;
  if(typeof d?.symbol!=='string'||!/^[A-Z0-9]{3,30}$/.test(d.symbol))return;symbol=d.symbol;void load();
 };
 frame.addEventListener('change',()=>void load());
 fit.addEventListener('click',()=>chart?.timeScale().fitContent());
 full.addEventListener('click',()=>{if(document.fullscreenElement===host)void document.exitFullscreen();else void host.requestFullscreen()});
 draw.addEventListener('click',()=>{lineMode=!lineMode;draw.setAttribute('aria-pressed',String(lineMode));message(lineMode?'Click a candle to add a horizontal price line':'Drawing disabled')});
 clear.addEventListener('click',()=>{if(candles)for(const line of priceLines)candles.removePriceLine?.(line);priceLines=[]});
 const onChartClick=(param:{point?:{x:number;y:number}})=>{if(!lineMode||!candles||!param.point)return;
  const price=candles.coordinateToPrice?.(param.point.y);
  if(price===null||price===undefined||!Number.isFinite(price)||price<=0)return;
  const line=candles.createPriceLine?.({price,color:'#5865f2',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Level'});
  if(line)priceLines.push(line);
 };
 // Register after the asynchronous chart mounts.
 const registerClick=()=>chart?.subscribeClick?.(onChartClick);
 root.addEventListener('nexora:market-selected',market);void mount();
 return()=>{disposed=true;job++;abort?.abort();if(ws){ws.onclose=null;ws.close()}if(retry!==undefined)clearTimeout(retry);observer.disconnect();chart?.unsubscribeClick?.(onChartClick);root.removeEventListener('nexora:market-selected',market);chart?.remove();host.remove()};
}
