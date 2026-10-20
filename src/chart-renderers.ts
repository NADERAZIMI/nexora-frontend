import type { Candle } from './chart-types';
export const DIRECT_CHART_TYPES=['Bars','Candles','Hollow candles','Volume candles','Line','Line with markers','Step line','Area','HLC area','Baseline','Columns','High-low','Heikin Ashi'] as const;
export type DirectChartType=typeof DIRECT_CHART_TYPES[number];
export function isDirectChartType(s:string):s is DirectChartType{return (DIRECT_CHART_TYPES as readonly string[]).includes(s)}
export function heikinAshi(bars:Candle[]):Candle[]{
 let prevOpen=0,prevClose=0;
 return bars.map((c,i)=>{
  const close=(c.open+c.high+c.low+c.close)/4;
  const open=i===0?(c.open+c.close)/2:(prevOpen+prevClose)/2;
  const bar={...c,open,close,high:Math.max(c.high,open,close),low:Math.min(c.low,open,close)};
  prevOpen=open;prevClose=close;return bar;
 });
}
type Geometry={bars:Candle[];step:number;x:(index:number)=>number;y:(value:number)=>number;top:number;plotH:number;left:number;plotW:number};
export function drawChartType(ctx:CanvasRenderingContext2D,g:Geometry,type:DirectChartType){
 const bullish='#16b89a',bearish='#f05a70';
 const width=Math.max(3,Math.min(23,g.step*.78)),wick=Math.max(1.5,Math.min(2.5,g.step*.14));
 const drawCandles=(hollow=false,vol=false)=>{
  const maxVolume=Math.max(1,...g.bars.map(c=>c.volume));
  g.bars.forEach((c,i)=>{
   const up=c.close>=c.open,color=up?bullish:bearish,x=g.x(i),top=Math.min(g.y(c.open),g.y(c.close)),bottom=Math.max(g.y(c.open),g.y(c.close));
   ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=wick;
   ctx.beginPath();ctx.moveTo(x,g.y(c.high));ctx.lineTo(x,g.y(c.low));ctx.stroke();
   const bodyWidth=vol?Math.max(2,width*(.28+.72*c.volume/maxVolume)):width;
   const left=x-bodyWidth/2,height=Math.max(1,bottom-top);
   if(hollow&&up){ctx.lineWidth=1.5;ctx.strokeRect(left,top,bodyWidth,height)}else ctx.fillRect(left,top,bodyWidth,height);
  });
 };
 const drawPath=(step=false,fill=false,markers=false)=>{
  ctx.beginPath();let lastY=0;
  g.bars.forEach((c,i)=>{
   const x=g.x(i),y=g.y(c.close);
   if(i===0)ctx.moveTo(x,y);else if(step){ctx.lineTo(x,lastY);ctx.lineTo(x,y)}else ctx.lineTo(x,y);lastY=y;
  });
  ctx.strokeStyle='#a78bfa';ctx.lineWidth=2;ctx.stroke();
  if(fill&&g.bars.length){ctx.lineTo(g.x(g.bars.length-1),g.top+g.plotH);ctx.lineTo(g.x(0),g.top+g.plotH);ctx.closePath();ctx.fillStyle='rgba(167,139,250,.15)';ctx.fill()}
  if(markers){ctx.fillStyle='#a78bfa';g.bars.forEach((c,i)=>{ctx.beginPath();ctx.arc(g.x(i),g.y(c.close),Math.max(2,Math.min(4,g.step*.17)),0,Math.PI*2);ctx.fill()})}
 };
 switch(type){
 case 'Candles':case 'Heikin Ashi':drawCandles();break;
 case 'Hollow candles':drawCandles(true);break;
 case 'Volume candles':drawCandles(false,true);break;
 case 'Line':drawPath();break;
 case 'Line with markers':drawPath(false,false,true);break;
 case 'Step line':drawPath(true);break;
 case 'Area':drawPath(false,true);break;
 case 'HLC area':{
  ctx.beginPath();g.bars.forEach((c,i)=>i?ctx.lineTo(g.x(i),g.y(c.high)):ctx.moveTo(g.x(i),g.y(c.high)));
  for(let i=g.bars.length-1;i>=0;i--)ctx.lineTo(g.x(i),g.y(g.bars[i].low));
  ctx.closePath();ctx.fillStyle='rgba(88,101,242,.12)';ctx.fill();drawPath();break;
 }
 case 'Baseline':{
  const baseline=g.bars[0]?.close??0;
  ctx.strokeStyle='#798596';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(g.left,g.y(baseline));ctx.lineTo(g.left+g.plotW,g.y(baseline));ctx.stroke();ctx.setLineDash([]);
  g.bars.forEach((c,i)=>{ctx.strokeStyle=c.close>=baseline?bullish:bearish;ctx.lineWidth=Math.max(2,g.step*.45);ctx.beginPath();ctx.moveTo(g.x(i),g.y(baseline));ctx.lineTo(g.x(i),g.y(c.close));ctx.stroke()});break;
 }
 case 'Columns':{
  const zero=g.top+g.plotH;g.bars.forEach((c,i)=>{ctx.fillStyle=c.close>=c.open?bullish:bearish;ctx.fillRect(g.x(i)-width/2,g.y(c.close),width,Math.max(1,zero-g.y(c.close)))});break;
 }
 case 'High-low':{
  g.bars.forEach((c,i)=>{const x=g.x(i);ctx.strokeStyle=c.close>=c.open?bullish:bearish;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,g.y(c.high));ctx.lineTo(x,g.y(c.low));ctx.stroke();ctx.beginPath();ctx.moveTo(x-width/3,g.y(c.close));ctx.lineTo(x+width/3,g.y(c.close));ctx.stroke()});break;
 }
 case 'Bars':{
  g.bars.forEach((c,i)=>{const x=g.x(i);ctx.strokeStyle=c.close>=c.open?bullish:bearish;ctx.lineWidth=wick;ctx.beginPath();ctx.moveTo(x,g.y(c.high));ctx.lineTo(x,g.y(c.low));ctx.moveTo(x-width/2,g.y(c.open));ctx.lineTo(x,g.y(c.open));ctx.moveTo(x,g.y(c.close));ctx.lineTo(x+width/2,g.y(c.close));ctx.stroke()});break;
 }
 }
 ctx.lineWidth=1;
}
