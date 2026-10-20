/** Read-only Spot analytics from Bybit V5 public WebSocket. Separate from headline/depth sockets. */
type Tick={symbol?:string;lastPrice?:string;price24hPcnt?:string;highPrice24h?:string;lowPrice24h?:string;volume24h?:string;turnover24h?:string;prevPrice24h?:string};
type Candle={start?:number;open?:string;high?:string;low?:string;close?:string;volume?:string;turnover?:string;confirm?:boolean};
type Trade={i?:string;T?:number;p?:string;v?:string;S?:string;s?:string};
const numeric=(v:unknown):number|null=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const fmt=(v:unknown,d=4)=>{const n=numeric(v);return n===null?'—':n.toLocaleString('en-US',{maximumFractionDigits:d})};
const escapeText=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
export function attachSpotChartTabs(root:HTMLElement):()=>void{
 const header=root.querySelector<HTMLElement>('[class*="__chartWrapper"] [class*="__chartHeader"]');
 const original=header?.querySelector<HTMLElement>('[role="tablist"]');
 const chart=header?.closest<HTMLElement>('[class*="__chartWrapper"]');
 if(!header||!original||!chart)return ()=>{};
 const oldDisplay=original.style.display;original.style.display='none';
 const nav=document.createElement('div');nav.className='nexora-chart-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Spot chart sections');
 const names=['Chart','Overview','Data','Feed','Trade Analysis'] as const;
 const buttons=names.map((name,i)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===0));b.tabIndex=i===0?0:-1;nav.append(b);return b});
 const view=document.createElement('section');view.className='nexora-chart-tab-content';view.setAttribute('role','tabpanel');chart.append(view);
 const oldPlaceholder=chart.querySelector<HTMLElement>('.nexora-bybit-chart-pending');
 if(oldPlaceholder)oldPlaceholder.style.display='none';
 let active=0,symbol='BTCUSDT',base='BTC',quote='USDT',ticker:Tick|null=null;
 let ws:WebSocket|null=null,disposed=false,retry:number|undefined,ping:number|undefined,redraw:number|undefined,generation=0;
 const candles=new Map<number,Candle>();let trades:Trade[]=[];let latest:number[]=[];let lastUpdate=0;
 const stat=(label:string,value:string)=>'<div class="nexora-analytics-stat"><span>'+escapeText(label)+'</span><strong>'+escapeText(value)+'</strong></div>';
 const table=(head:string[],body:string[][])=>'<div class="nexora-analytics-table"><div class="nexora-analytics-line heading">'+head.map(x=>'<span>'+escapeText(x)+'</span>').join('')+'</div>'+body.map(c=>'<div class="nexora-analytics-line">'+c.map(x=>'<span>'+escapeText(x)+'</span>').join('')+'</div>').join('')+'</div>';
 const closeSocket=()=>{generation++;if(retry!==undefined)clearTimeout(retry);if(ping!==undefined)clearInterval(ping);if(ws){ws.onclose=null;ws.close();ws=null}};
 const render=()=>{
  if(disposed)return;
  const title='<div class="nexora-analytics-title">'+escapeText(base+'/'+quote)+' · NEXORA Spot <span>'+(lastUpdate?'Live public market data':'Waiting for live market data')+'</span></div>';
  const entries=[...candles.values()].sort((a,b)=>(a.start||0)-(b.start||0));
  const closes=entries.map(c=>numeric(c.close)).filter((x):x is number=>x!==null);
  const line=active===0?(closes.length>=2?closes:latest):[];
  if(active===0){
   if(line.length<2){view.innerHTML=title+'<div class="nexora-analytics-empty">Waiting for live prices to build the chart…</div>';return}
   const width=900,height=320,min=Math.min(...line),max=Math.max(...line),span=max-min||1;
   const pts=line.map((v,i)=>(20+i*860/Math.max(1,line.length-1)).toFixed(1)+','+(height-20-(v-min)/span*(height-45)).toFixed(1)).join(' ');
   const label=closes.length>=2?'Live 1-minute candle closes':'Live price updates';
   view.innerHTML=title+'<div class="nexora-live-chart-caption">'+label+' · '+fmt(String(line[line.length-1]),8)+' '+escapeText(quote)+'</div><svg class="nexora-live-chart" viewBox="0 0 900 320" preserveAspectRatio="none" role="img" aria-label="Live price history"><polyline points="'+pts+'" fill="none" stroke="#5865F2" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="nexora-live-chart-foot">Observed prices since this tab connected · Not a historical trading chart</div>';
  }else if(active===1){
   const change=numeric(ticker?.price24hPcnt);
   view.innerHTML=title+'<div class="nexora-analytics-stats">'+[
    stat('Last price',fmt(ticker?.lastPrice,8)+' '+quote),stat('24h change',change===null?'—':(change*100).toFixed(2)+'%'),
    stat('24h high',fmt(ticker?.highPrice24h,8)),stat('24h low',fmt(ticker?.lowPrice24h,8)),
    stat('24h volume ('+base+')',fmt(ticker?.volume24h,4)),stat('24h turnover ('+quote+')',fmt(ticker?.turnover24h,2))
   ].join('')+'</div>';
  }else if(active===2){
   view.innerHTML=title+'<div class="nexora-analytics-subtitle">Live 1-minute OHLCV · '+entries.length+' observed candles</div>'+(entries.length?table(['Time','Open','High','Low','Close','Volume'],entries.slice(-14).reverse().map(c=>[new Date(c.start||0).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),fmt(c.open,8),fmt(c.high,8),fmt(c.low,8),fmt(c.close,8),fmt(c.volume,4)])):'<div class="nexora-analytics-empty">Waiting for live candle data…</div>');
  }else if(active===3){
   view.innerHTML=title+'<div class="nexora-analytics-subtitle">Recent public trades · latest first</div>'+(trades.length?table(['Time','Side','Price ('+quote+')','Quantity ('+base+')'],trades.slice(0,30).map(t=>[new Date(t.T||0).toLocaleTimeString('en-GB'),t.S==='Buy'?'Buy':t.S==='Sell'?'Sell':'—',fmt(t.p,8),fmt(t.v,8)])):'<div class="nexora-analytics-empty">Waiting for live trades…</div>');
  }else{
   const buys=trades.filter(t=>t.S==='Buy'),sells=trades.filter(t=>t.S==='Sell');
   const volume=(xs:Trade[])=>xs.reduce((a,t)=>a+(numeric(t.v)||0),0);
   const buyVol=volume(buys),sellVol=volume(sells),combined=buyVol+sellVol;
   const opens=entries.slice(-2),last=opens.length?opens[opens.length-1]:null;
   view.innerHTML=title+'<div class="nexora-analytics-subtitle">Trade analysis of '+trades.length+' recently observed public trades · not market-wide 24h totals</div><div class="nexora-analytics-stats">'+[
    stat('Observed Buy trades',String(buys.length)),stat('Observed Sell trades',String(sells.length)),
    stat('Buy volume ('+base+')',buyVol.toLocaleString('en-US',{maximumFractionDigits:8})),
    stat('Sell volume ('+base+')',sellVol.toLocaleString('en-US',{maximumFractionDigits:8})),
    stat('Observed Buy volume share',combined?(buyVol/combined*100).toFixed(2)+'%':'—'),
    stat('Current 1m candle volume',fmt(last?.volume,8))
   ].join('')+'</div>';
  }
 };
 const schedule=()=>{if(redraw!==undefined)return;redraw=window.setTimeout(()=>{redraw=undefined;render()},180)};
 const connect=()=>{
  if(disposed)return;closeSocket();const myGeneration=generation;
  const current=new WebSocket('wss://stream.bybit.com/v5/public/spot');ws=current;
  current.onopen=()=>{if(ws!==current||disposed)return;current.send(JSON.stringify({op:'subscribe',args:['tickers.'+symbol,'kline.1.'+symbol,'publicTrade.'+symbol]}));ping=window.setInterval(()=>{if(current.readyState===WebSocket.OPEN)current.send(JSON.stringify({op:'ping'}))},20000)};
  current.onmessage=(event:MessageEvent)=>{
   if(disposed||ws!==current||generation!==myGeneration)return;
   try{
    const msg=JSON.parse(String(event.data)) as {topic?:string;data?:unknown};
    if(msg.topic==='tickers.'+symbol&&msg.data&&typeof msg.data==='object'&&!Array.isArray(msg.data)){
     const d=msg.data as Tick;if(d.symbol&&d.symbol!==symbol)return;
     ticker={...ticker,...d};
     const n=numeric(ticker.lastPrice);if(n!==null){latest.push(n);if(latest.length>180)latest.shift()}
    }else if(msg.topic==='kline.1.'+symbol&&Array.isArray(msg.data)){
     for(const d of msg.data as Candle[]){if(typeof d.start!=='number'||numeric(d.close)===null)continue;candles.set(d.start,d)}
     if(candles.size>180)for(const k of [...candles.keys()].sort((a,b)=>a-b).slice(0,candles.size-180))candles.delete(k);
    }else if(msg.topic==='publicTrade.'+symbol&&Array.isArray(msg.data)){
     const incoming=(msg.data as Trade[]).filter(t=>t.s===symbol&&typeof t.T==='number'&&numeric(t.p)!==null&&numeric(t.v)!==null);
     const seen=new Set<string>();trades=[...incoming,...trades].filter(t=>{const key=t.i||[t.T,t.p,t.v,t.S].join('/');if(seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>(b.T||0)-(a.T||0)).slice(0,200);
    }else return;
    lastUpdate=Date.now();schedule();
   }catch{/* Ignore invalid external frames. */}
  };
  current.onclose=()=>{if(disposed||ws!==current)return;ws=null;if(ping!==undefined)clearInterval(ping);retry=window.setTimeout(connect,3000)};
  current.onerror=()=>{if(ws===current){lastUpdate=0;schedule()}};
 };
 const select=(index:number)=>{active=index;buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1});render()};
 const handlers=buttons.map((button,index)=>{
  const click=(event:MouseEvent)=>{event.preventDefault();event.stopPropagation();select(index)};
  const keyboard=(event:KeyboardEvent)=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;select(next);buttons[next].focus()};
  button.addEventListener('click',click);button.addEventListener('keydown',keyboard);
  return()=>{button.removeEventListener('click',click);button.removeEventListener('keydown',keyboard)};
 });
 const onMarket=(event:Event)=>{const d=(event as CustomEvent<{symbol?:string;base?:string;quote?:string;category?:string}>).detail;if(!d?.symbol||d.category&&d.category!=='spot')return;if(!/^[A-Z0-9]{3,30}$/.test(d.symbol))return;symbol=d.symbol;base=d.base||symbol;quote=d.quote||'USDT';ticker=null;trades=[];latest=[];candles.clear();lastUpdate=0;render();connect()};
 header.prepend(nav);root.addEventListener('nexora:market-selected',onMarket);render();connect();
 return()=>{disposed=true;closeSocket();if(redraw!==undefined)clearTimeout(redraw);handlers.forEach(x=>x());root.removeEventListener('nexora:market-selected',onMarket);nav.remove();view.remove();original.style.display=oldDisplay;if(oldPlaceholder)oldPlaceholder.style.display=''};
}
