import {useMemo,useState} from 'react';
import './DataPanel.css';

type Tab='Fund Flow'|'Trade data'|'Trading Trend';
type Point={a:number;b:number;c?:number};
const demo=(seed:number,count=24):Point[]=>Array.from({length:count},(_,i)=>({a:Math.max(5,45+25*Math.sin(i*.52+seed)+14*Math.cos(i*1.19+seed)),b:Math.max(4,36+19*Math.cos(i*.61+seed)+13*Math.sin(i*.93)),c:40+28*Math.sin(i*.39+seed*.35)}));
function Plot({series,kind='line',colors=['#328ff8','#efa300'],labels=['Series A','Series B']}:{series:Point[];kind?:'line'|'area'|'bar';colors?:string[];labels?:string[]}){
 const width=560,height=275,left=40,right=15,top=24,bottom=32,inner=width-left-right,h=height-top-bottom;
 const max=Math.max(100,...series.map(x=>Math.max(x.a,x.b)))*1.05;
 const xy=(v:number,i:number)=>[left+i*inner/Math.max(1,series.length-1),top+h-v/max*h];
 const path=(key:'a'|'b')=>series.map((v,i)=>{const [x,y]=xy(v[key],i);return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ');
 return <><svg className="data-plot" viewBox={'0 0 '+width+' '+height} role="img" aria-label={labels.join(' and ')+' demo chart'}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1={left} x2={width-right} y1={top+i*h/4} y2={top+i*h/4} stroke="#32363e" strokeDasharray="4 3"/><text x="31" y={top+i*h/4+4} fontSize="10" fill="#697484" textAnchor="end">{Math.round(max*(4-i)/4)}</text></g>)}
 {kind==='bar'?series.map((v,i)=>{const bw=inner/series.length*.6;const [x,y]=xy(v.a,i);return <rect key={i} x={x-bw/2} y={y} width={bw} height={top+h-y} fill={v.a>55?'#16B89A':'#F05A70'} />;}):<>{kind==='area'&&<path d={path('a')+' L '+(left+inner)+' '+(top+h)+' L '+left+' '+(top+h)+' Z'} fill="#328ff8" opacity=".14"/>}<path d={path('a')} fill="none" stroke={colors[0]} strokeWidth="2.1" strokeLinejoin="round"/><path d={path('b')} fill="none" stroke={colors[1]} strokeWidth="1.8" strokeLinejoin="round"/></>}
 {Array.from({length:5},(_,i)=><text key={i} x={left+i*inner/4} y={height-9} fontSize="10" fill="#737a86" textAnchor="middle">{['09-20','09-27','10-04','10-11','10-20'][i]}</text>)}
 </svg><div className="data-legend">{labels.map((label,i)=><span key={label}><i style={{background:colors[i]||'#16B89A'}}/>{label}</span>)}</div></>;
}
function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="data-card-wrap"><h3>{title}</h3><div className="data-card">{children}</div></section>}
function Pick({items,value,onChange}:{items:string[];value:string;onChange:(x:string)=>void}){return <div className="data-periods">{items.map(x=><button type="button" key={x} onClick={()=>onChange(x)} className={x===value?'active':''}>{x}</button>)}</div>}
function Ring(){
 const parts=[35.11,6.99,3.72,3.62,7.11,43.45];const palette=['#F56C73','#f33e56','#b62c48','#06976d','#15a879','#3dbc83'];let acc=0;
 const stops=parts.map((v,i)=>{const before=acc;acc+=v;return palette[i]+' '+before+'% '+acc+'%'}).join(', ');
 return <><div className="data-donut" style={{background:'conic-gradient('+stops+')'}}><span/></div><div className="data-flow-sums"><div>Inflow: <strong className="positive">39.13 BTC</strong><p>■ Large　31.39</p><p>■ Medium　5.13</p><p>■ Small　2.61</p></div><div>Outflow: <strong className="negative">33.09 BTC</strong><p>■ Large　25.35</p><p>■ Medium　5.05</p><p>■ Small　2.68</p></div></div></>;
}
export default function DataPanel({symbol}:{symbol:string}){
 const [tab,setTab]=useState<Tab>('Fund Flow'),[period,setPeriod]=useState('5m'),[range,setRange]=useState('Day'),[rank,setRank]=useState('Most Starred');
 const points=useMemo(()=>demo(period.length+symbol.length),[period,symbol]);
 const nav:Tab[]=['Fund Flow','Trade data','Trading Trend'];
 return <div className="data-workspace">
 <div className="data-nav">{nav.map(x=><button type="button" key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}<span className="data-demo-label">DEMO DATA · Illustrative charts, not live exchange metrics</span></div>
 {tab==='Fund Flow'?<div className="data-grid"><Card title="Crypto flow analysis"><Pick items={['5m','15m','30m','1h','12h','1D']} value={period} onChange={setPeriod}/><p className="data-range-label">Illustrative {period} interval · {symbol}</p><Ring/></Card><Card title="Net crypto flow"><Pick items={['Day','Week']} value={range} onChange={setRange}/><Plot kind="bar" series={demo(range==='Day'?7:8,8)} colors={['#16B89A','#F05A70']} labels={['Inflow','Outflow']}/></Card></div>
 :tab==='Trade data'?<div className="data-grid"><Card title="UTA loan growth rate"><Pick items={['Day','Week','Month']} value={range} onChange={setRange}/><Plot series={demo(4)} colors={['#ee9700','#ee9700']} labels={['UTA loan growth rate']}/></Card><Card title="Bid-ask spread"><Pick items={['5m','15m','30m','1h','1D']} value={period} onChange={setPeriod}/><Plot series={demo(9)} colors={['#ee9700','#16B89A']} labels={['Fair','Spread']}/></Card><div className="data-wide"><Card title="Taker buy/sell volume"><Pick items={['5m','15m','30m','1h','1D']} value={period} onChange={setPeriod}/><Plot series={points} colors={['#16B89A','#F05A70']} labels={['Taker Buy','Taker Sell']}/></Card></div></div>
 :<><div className="data-grid"><Card title="Spot Trading Volume"><Plot kind="area" series={demo(3)} colors={['#328ff8','#328ff8']} labels={['Spot volume']}/></Card><Card title="User Behavior Trends"><Plot series={demo(8)} colors={['#f0a600','#328ff8']} labels={['Search','Favorite']}/></Card></div><div className="data-ranking"><h3>Top 10 Rankings</h3><Pick items={['Most Starred','Most Searched']} value={rank} onChange={setRank}/><p>Demo ranking data is intentionally omitted. Connect verified usage analytics to populate this list.</p></div></>}
 </div>;
}
