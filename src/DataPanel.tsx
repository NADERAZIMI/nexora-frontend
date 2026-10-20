import {useMemo,useState,type ReactNode} from 'react';
import {useBybitPublicFlow,type FlowTrade} from './useBybitPublicFlow';
import './DataPanel.css';

type Tab='Fund Flow'|'Trade data'|'Trading Trend';
type Bucket={buy:number;sell:number};
const periods:{[key:string]:number}={'5m':300000,'15m':900000,'30m':1800000,'1h':3600000};
const money=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2});
const format=(n:number)=>n>=1000000?(n/1000000).toFixed(2)+'M':n>=1000?(n/1000).toFixed(2)+'K':n.toFixed(2);
function Selector({items,value,onChange}:{items:string[];value:string;onChange:(s:string)=>void}){return <div className="data-periods">{items.map(s=><button type="button" key={s} className={s===value?'active':''} onClick={()=>onChange(s)}>{s}</button>)}</div>}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="data-card-wrap"><h3>{title}</h3><div className="data-card">{children}</div></section>}
function Empty({text}:{text:string}){return <p className="data-real-empty">{text}</p>}
function FlowDonut({buckets,unit}:{buckets:{buy:number[];sell:number[]};unit:string}){
 const all=[...buckets.sell,...buckets.buy],total=all.reduce((a,b)=>a+b,0);
 if(!total)return <Empty text="Waiting for observed public Spot trades…"/>;
 const colors=['#f56772','#f13c60','#ae2f48','#087b65','#17a57e','#3dbc83'];
 let at=0;const stops=all.map((v,i)=>{const start=at;at+=v/total*100;return colors[i]+' '+start+'% '+at+'%'}).join(',');
 const cols=(vals:number[],side:string)=> <div><div>{side}: <strong className={side==='Aggressive Buy'?'positive':'negative'}>{format(vals.reduce((a,b)=>a+b,0))} {unit}</strong></div>{['Large','Medium','Small'].map((name,i)=><p key={name}>{name}<span>{format(vals[i])}</span></p>)}</div>;
 return <><div className="data-donut" style={{background:'conic-gradient('+stops+')'}}><span/></div><div className="data-flow-sums">{cols(buckets.buy,'Aggressive Buy')}{cols(buckets.sell,'Aggressive Sell')}</div></>;
}
function LiveBar({items,unit}:{items:Bucket[];unit:string}){
 const max=Math.max(1,...items.map(x=>Math.max(x.buy,x.sell))),h=230,w=550,gap=9,bar=19;
 return <><svg className="data-plot" viewBox="0 0 550 280" role="img" aria-label={'Observed taker buy and sell volume '+unit}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1="35" x2="540" y1={20+i*h/4} y2={20+i*h/4} stroke="#353842" strokeDasharray="4 3"/><text x="30" y={25+i*h/4} fill="#949eaf" fontSize="12" textAnchor="end">{format(max*(4-i)/4)}</text></g>)}
 {items.map((v,i)=>{const left=46+i*(w-65)/items.length;return <g key={i}><rect x={left} y={250-v.buy/max*h} width={bar} height={v.buy/max*h} fill="#16B89A"/><rect x={left+bar+2} y={250-v.sell/max*h} width={bar} height={v.sell/max*h} fill="#F05A70"/><text x={left+bar} y="273" fill="#929AAA" fontSize="11" textAnchor="middle">{i+1}</text></g>})}
 </svg><div className="data-legend"><span><i style={{background:'#16B89A'}}/>Taker Buy</span><span><i style={{background:'#F05A70'}}/>Taker Sell</span></div></>;
}
function byWindow(trades:FlowTrade[],duration:number,now:number){return trades.filter(x=>x.timestamp>=now-duration&&x.timestamp<=now);}
function bins(trades:FlowTrade[],duration:number,now:number):Bucket[]{const steps=8;const start=now-duration;const result=Array.from({length:steps},()=>({buy:0,sell:0}));for(const t of trades){const idx=Math.min(steps-1,Math.max(0,Math.floor((t.timestamp-start)/duration*steps)));result[idx][t.side==='Buy'?'buy':'sell']+=t.price*t.quantity;}return result;}
export default function DataPanel({symbol}:{symbol:string}){
 const [tab,setTab]=useState<Tab>('Fund Flow'),[period,setPeriod]=useState('5m');
 const live=useBybitPublicFlow(symbol);
 const now=live.trades[live.trades.length-1]?.timestamp??Date.now();
 const windowTrades=useMemo(()=>byWindow(live.trades,periods[period],now),[live.trades,period,now]);
 const summary=useMemo(()=>{const buy=[0,0,0],sell=[0,0,0];for(const t of windowTrades){const usd=t.price*t.quantity;const index=usd>=10000?0:usd>=1000?1:2;(t.side==='Buy'?buy:sell)[index]+=t.quantity;}return {buy,sell};},[windowTrades]);
 const bars=useMemo(()=>bins(windowTrades,periods[period],now),[windowTrades,period,now]);
 const totalBuy=windowTrades.filter(t=>t.side==='Buy').reduce((v,t)=>v+t.price*t.quantity,0);
 const totalSell=windowTrades.filter(t=>t.side==='Sell').reduce((v,t)=>v+t.price*t.quantity,0);
 return <div className="data-workspace"><div className="data-nav">{(['Fund Flow','Trade data','Trading Trend'] as const).map(x=><button key={x} type="button" className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}<span className="data-demo-label">{live.connected?'● LIVE PUBLIC TRADES':'○ CONNECTING'} · Observed since opening this tab · Not deposits/withdrawals</span></div>
 {tab==='Fund Flow'?<div className="data-grid"><Panel title="Aggressive buy/sell volume"><Selector items={Object.keys(periods)} value={period} onChange={setPeriod}/><p className="data-range-label">{symbol} · {period} · {windowTrades.length} observed trades · Large ≥ $10k, Medium ≥ $1k</p><FlowDonut buckets={summary} unit={symbol.replace(/USDT$|USDC$|BTC$|ETH$/,'')}/></Panel><Panel title="Net taker flow"><Selector items={Object.keys(periods)} value={period} onChange={setPeriod}/>{windowTrades.length?<><LiveBar items={bars} unit="USDT"/><p className="data-range-label">Net taker flow: {money(totalBuy-totalSell)} quote units · Buy {money(totalBuy)} / Sell {money(totalSell)}</p></>:<Empty text={live.error||'Waiting for observed public trades…'}/>}</Panel></div>
 :tab==='Trade data'?<div className="data-grid"><Panel title="Bid-ask spread"><Empty text="Order-book spread history requires timestamped snapshots. No estimated spread chart is shown."/></Panel><Panel title="UTA loan growth rate"><Empty text="Verified lending statistics are not available through the public Spot trade feed."/></Panel><div className="data-wide"><Panel title="Taker buy/sell volume"><Selector items={Object.keys(periods)} value={period} onChange={setPeriod}/>{windowTrades.length?<LiveBar items={bars} unit="quote currency"/>:<Empty text={live.error||'Waiting for observed Spot trades…'}/>}</Panel></div></div>
 :<div className="data-grid"><Panel title="Spot Trading Volume"><Empty text="Verified historical aggregate volume will be available when market history is connected."/></Panel><Panel title="User Behavior Trends"><Empty text="NEXORA search and favorite statistics require first-party analytics; no simulated usage counts."/></Panel></div>}
 </div>;
}
