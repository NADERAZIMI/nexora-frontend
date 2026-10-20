import { drawChartType, heikinAshi, isDirectChartType, type DirectChartType } from './chart-renderers';
import type { Candle } from './live-market-feed';

type Point={time:number;price:number};
type Line={a:Point;b:Point};
type Mode='pan'|'trend';
export function createInteractiveSpotChart(canvas:HTMLCanvasElement, host:HTMLElement){
 let data:Candle[]=[],visible=85,offset=0,vertical=1,mode:Mode='pan',pointer:{x:number;y:number}|null=null;
 let drag:{x:number;y:number;offset:number;vertical:number}|null=null;
 let draft:Point|null=null,lines:Line[]=[],ma=true,ema=true,livePrice:number|null=null,chartType:DirectChartType='Candles';
 const controls=document.createElement('div');controls.className='nexora-chart-tools';
 const button=(icon:string,title:string,handler:()=>void)=>{
  const b=document.createElement('button');b.type='button';b.textContent=icon;b.title=title;
  b.setAttribute('aria-label',title);b.onclick=handler;controls.append(b);return b;
 };
 const panButton=button('↔','Move / Pan',()=>{mode='pan';sync()});
 const trendButton=button('♢','Trend Line',()=>{mode='trend';sync()});
 const maButton=button('ƒₓ','MA 5 / 10 / 20',()=>{ma=!ma;sync()});
 const emaButton=button('≋','EMA 20',()=>{ema=!ema;sync()});
 const placeholder=(glyph:string,title:string)=>{
  const b=document.createElement('button');b.type='button';b.textContent=glyph;
  b.title=title+' (coming later)';b.setAttribute('aria-label',title+' (coming later)');
  b.disabled=true;b.className='nexora-chart-tool-pending';controls.append(b);
 };
 placeholder('☷','Indicator list');
 placeholder('▣','Chart screenshot');
 placeholder('▣','Calendar');
 button('↺','Reset chart zoom',()=>{visible=85;offset=0;vertical=1;pointer=null;draw()});
 button('⌫','Clear trend lines',()=>{lines=[];draft=null;draw()});
 host.append(controls);
 const right=document.createElement('div');right.className='nexora-chart-display-modes';
 const modes=['Original','TradingView','Depth'] as const;
 for(const label of modes){
  const b=document.createElement('button');b.type='button';b.textContent=label;
  if(label==='Original'){b.className='is-active';b.setAttribute('aria-pressed','true')}
  else{b.disabled=true;b.title=label+' (coming later)';b.setAttribute('aria-disabled','true')}
  right.append(b);
 }
 const full=document.createElement('button');full.type='button';full.className='nexora-chart-fullscreen';full.textContent='⛶';
 full.title='Fullscreen (coming later)';full.setAttribute('aria-label','Fullscreen (coming later)');full.disabled=true;
 host.append(right,full);
 const sync=()=>{panButton.setAttribute('aria-pressed',String(mode==='pan'));trendButton.setAttribute('aria-pressed',String(mode==='trend'));maButton.setAttribute('aria-pressed',String(ma));emaButton.setAttribute('aria-pressed',String(ema));canvas.style.cursor=mode==='trend'?'crosshair':'grab';draw()};
 const geometry=()=>{
  const w=Math.max(250,canvas.clientWidth),h=Math.max(170,canvas.clientHeight),right=83,bottom=26,left=10,top=53,volumeHeight=Math.max(65,Math.min(120,h*.23));
  const n=Math.max(12,Math.min(data.length,Math.round(visible))),last=Math.max(n,Math.min(data.length,data.length-offset)),start=Math.max(0,last-n);
  const bars=data.slice(start,last),min=Math.min(...bars.map(x=>x.low)),max=Math.max(...bars.map(x=>x.high));
  const center=(min+max)/2,span=Math.max((max-min)*1.15/vertical,center*.000001,1e-12);
  const lower=center-span/2,upper=center+span/2,plotW=w-right-left,plotH=h-bottom-top-volumeHeight,step=plotW/Math.max(1,bars.length);
  const x=(i:number)=>left+(i+.5)*step,y=(v:number)=>top+(upper-v)/span*plotH;
  const price=(py:number)=>upper-(py-top)/plotH*span;
  return {w,h,left,top,right,bottom,volumeHeight,bars,start,lower,upper,plotW,plotH,step,x,y,price};
 };
 const fmt=(v:number)=>v>=100? v.toLocaleString('en-US',{maximumFractionDigits:2}):v>=1?v.toFixed(4):v.toPrecision(6);
 const sma=(end:number,n:number)=>{if(end<n-1)return null;let total=0;for(let k=end-n+1;k<=end;k++)total+=data[k].close;return total/n};
 const volumeAverage=(end:number,n:number)=>{if(end<n-1)return null;let v=0;for(let i=end-n+1;i<=end;i++)v+=data[i].volume;return v/n};
 const emaSeries=()=>{const out:number[]=[];const alpha=2/21;let prev=data[0]?.close??0;for(const bar of data){prev=alpha*bar.close+(1-alpha)*prev;out.push(prev)}return out};
 const draw=()=>{
  const g=geometry(),dpr=window.devicePixelRatio||1;canvas.width=Math.round(g.w*dpr);canvas.height=Math.round(g.h*dpr);
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,g.w,g.h);
  ctx.font='11px Arial';ctx.textBaseline='middle';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const val=g.lower+(g.upper-g.lower)*i/4,yy=g.y(val);
   ctx.strokeStyle='#262a31';ctx.beginPath();ctx.moveTo(g.left,yy);ctx.lineTo(g.w-g.right,yy);ctx.stroke();
   ctx.fillStyle='#929aaa';ctx.fillText(fmt(val),g.w-g.right+6,yy);
  }
  if(!g.bars.length){ctx.fillStyle='#929aaa';ctx.fillText('No candles available',20,40);return}
  const renderBars=chartType==='Heikin Ashi'?heikinAshi(data).slice(g.start,g.start+g.bars.length):g.bars;
  drawChartType(ctx,{...g,bars:renderBars},chartType);
  const indicator=(color:string,value:(idx:number)=>number|null)=>{ctx.strokeStyle=color;ctx.lineWidth=1.35;ctx.beginPath();let drawn=false;
   for(let i=0;i<g.bars.length;i++){const v=value(g.start+i);if(v===null)continue;const xx=g.x(i),yy=g.y(v);if(!drawn){ctx.moveTo(xx,yy);drawn=true}else ctx.lineTo(xx,yy)}
   if(drawn)ctx.stroke();ctx.lineWidth=1};
  if(ma){indicator('#f6bc48',i=>sma(i,5));indicator('#ad7ef4',i=>sma(i,10));indicator('#91ac73',i=>sma(i,20));}
  if(ema){const values=emaSeries();indicator('#ab7bee',i=>values[i]??null)}
  // Bottom volume panel shares the exact horizontal candle/time scale.
  const volumeTop=g.top+g.plotH+12,volumeBottom=g.h-g.bottom-8;
  const volumeMax=Math.max(1,...g.bars.map(c=>c.volume));
  ctx.fillStyle='#929aaa';ctx.fillText('VOL',g.left+4,volumeTop+4);
  g.bars.forEach((c,i)=>{const size=c.volume/volumeMax*Math.max(1,volumeBottom-volumeTop-22);
   ctx.fillStyle=c.close>=c.open?'#16876f':'#a64052';
   ctx.fillRect(g.x(i)-Math.min(8,g.step*.3),volumeBottom-size,Math.max(1,Math.min(16,g.step*.6)),size)});
  const volumeIndicator=(n:number,color:string)=>{ctx.beginPath();ctx.strokeStyle=color;let started=false;
   for(let i=0;i<g.bars.length;i++){const v=volumeAverage(g.start+i,n);if(v===null)continue;
    const yy=volumeBottom-v/volumeMax*Math.max(1,volumeBottom-volumeTop-22);
    if(!started){ctx.moveTo(g.x(i),yy);started=true}else ctx.lineTo(g.x(i),yy)}
   if(started)ctx.stroke();};
  volumeIndicator(5,'#f6bc48');volumeIndicator(10,'#ad7ef4');
  ctx.strokeStyle='#292d35';ctx.beginPath();ctx.moveTo(g.left,volumeTop-7);ctx.lineTo(g.w-g.right,volumeTop-7);ctx.stroke();
  const reference=g.bars[g.bars.length-1];
  const shown=pointer&&pointer.x>=g.left&&pointer.x<g.w-g.right?g.bars[Math.max(0,Math.min(g.bars.length-1,Math.floor((pointer.x-g.left)/g.step)))]:reference;
  const delta=shown.open?((shown.close-shown.open)/shown.open*100):0;
  ctx.font='12px Arial';ctx.fillStyle='#dce2e9';
  const stamp=new Date(shown.time).toLocaleString('en-GB',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  ctx.fillText(stamp+'   Open '+fmt(shown.open)+'   Close '+fmt(shown.close)+'   High '+fmt(shown.high)+'   Low '+fmt(shown.low)+'   Vol '+shown.volume.toLocaleString('en-US',{notation:'compact',maximumFractionDigits:2})+'   Change '+delta.toFixed(2)+'%',g.left+4,15);
  ctx.font='11px Arial';
  if(ma){ctx.fillStyle='#f6bc48';ctx.fillText('MA5 '+fmt(sma(data.indexOf(shown),5)??0),g.left+4,35);
   ctx.fillStyle='#ad7ef4';ctx.fillText('MA10 '+fmt(sma(data.indexOf(shown),10)??0),g.left+125,35);
   ctx.fillStyle='#91ac73';ctx.fillText('MA20 '+fmt(sma(data.indexOf(shown),20)??0),g.left+259,35);}
  if(livePrice!==null&&livePrice>=g.lower&&livePrice<=g.upper){
   const yy=g.y(livePrice);ctx.strokeStyle='#16b89a';ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(g.left,yy);ctx.lineTo(g.w-g.right,yy);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle='#16b89a';ctx.fillRect(g.w-g.right,yy-10,g.right,20);ctx.fillStyle='#fff';ctx.fillText(fmt(livePrice),g.w-g.right+5,yy);
  }
  const pointXY=(p:Point)=>{const idx=data.findIndex(x=>x.time===p.time);return idx>=g.start&&idx<g.start+g.bars.length?{x:g.x(idx-g.start),y:g.y(p.price)}:null};
  const trend=(a:Point,b:Point,dashed=false)=>{const A=pointXY(a),B=pointXY(b);if(!A||!B)return;ctx.strokeStyle='#68a0ff';ctx.lineWidth=2;ctx.setLineDash(dashed?[5,4]:[]);
   ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1};
  for(const l of lines)trend(l.a,l.b);
  if(pointer&&draft)trend(draft,{time:g.bars[Math.max(0,Math.min(g.bars.length-1,Math.floor((pointer.x-g.left)/g.step)))]?.time??draft.time,price:g.price(pointer.y)},true);
  for(let i=0;i<g.bars.length;i+=Math.max(1,Math.ceil(g.bars.length/6))){const c=g.bars[i];ctx.fillStyle='#929aaa';ctx.fillText(new Date(c.time).toLocaleDateString('en-GB',{month:'short',day:'numeric'}),g.x(i)-14,g.h-12)}
  if(pointer&&pointer.x>=g.left&&pointer.x<g.w-g.right&&pointer.y>=g.top&&pointer.y<g.h-g.bottom){
   const idx=Math.max(0,Math.min(g.bars.length-1,Math.floor((pointer.x-g.left)/g.step))),c=g.bars[idx];
   ctx.strokeStyle='#737d8d';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(g.x(idx),g.top);ctx.lineTo(g.x(idx),g.top+g.plotH);ctx.moveTo(g.left,pointer.y);ctx.lineTo(g.w-g.right,pointer.y);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle='#c9d4e5';ctx.fillText(new Date(c.time).toLocaleString('en-GB'),g.left+6,g.h-13);
   ctx.fillStyle='#20242d';ctx.fillRect(g.w-g.right,pointer.y-10,g.right,20);ctx.fillStyle='#f4f6fa';ctx.fillText(fmt(g.price(pointer.y)),g.w-g.right+5,pointer.y);
  }
 };
 const pos=(e:PointerEvent|MouseEvent)=>{const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top}};
 const down=(e:PointerEvent)=>{if(e.button!==0)return;const p=pos(e);pointer=p;
  if(mode==='trend'){const g=geometry(),index=Math.max(0,Math.min(g.bars.length-1,Math.floor((p.x-g.left)/g.step)));if(!g.bars[index])return;
   const point={time:g.bars[index].time,price:g.price(p.y)};
   if(draft){lines.push({a:draft,b:point});draft=null}else draft=point;draw();return}
  drag={...p,offset,vertical};canvas.setPointerCapture(e.pointerId);
 };
 const move=(e:PointerEvent)=>{pointer=pos(e);if(drag&&mode==='pan'){const g=geometry();
  offset=Math.max(0,Math.min(Math.max(0,data.length-12),Math.round(drag.offset+(pointer.x-drag.x)/g.step*-1)));
  vertical=Math.max(.3,Math.min(6,drag.vertical*Math.exp((pointer.y-drag.y)*-.006)));}
  draw();
 };
 const up=(e:PointerEvent)=>{drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)};
 const wheel=(e:WheelEvent)=>{e.preventDefault();if(e.ctrlKey||e.shiftKey)vertical=Math.max(.3,Math.min(6,vertical*(e.deltaY<0?1.12:.89)));
  else visible=Math.max(12,Math.min(Math.max(12,data.length),Math.round(visible*(e.deltaY<0?.85:1.18))));draw()};
 const leave=()=>{if(!drag){pointer=null;draw()}};
 const resize=()=>draw();
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);
 canvas.addEventListener('pointercancel',up);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('wheel',wheel,{passive:false});
 window.addEventListener('resize',resize);sync();
 return {setChartType(type:DirectChartType){if(isDirectChartType(type)){chartType=type;draw()}},setLivePrice(value:number|null){livePrice=value;draw()},setCandles(next:Candle[],reset=false){data=next;if(reset){offset=0;visible=85;vertical=1;draft=null;lines=[]}draw()},
 redraw:draw,dispose(){controls.remove();right.remove();full.remove();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);
 canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('wheel',wheel);window.removeEventListener('resize',resize)}};
}
