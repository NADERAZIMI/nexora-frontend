import {useEffect,useState} from 'react';
export type FlowTrade={id:string;timestamp:number;price:number;quantity:number;side:'Buy'|'Sell'};
type LiveFlow={trades:FlowTrade[];connected:boolean;error:string|null;since:number};
const empty=():LiveFlow=>({trades:[],connected:false,error:null,since:Date.now()});
/** Observed public spot trades, not exchange deposits/withdrawals. */
export function useBybitPublicFlow(symbol:string):LiveFlow{
 const [state,setState]=useState<LiveFlow>(empty);
 useEffect(()=>{
  if(!/^[A-Z0-9]{3,30}$/.test(symbol))return;
  let closed=false,ws:WebSocket|null=null,retry:ReturnType<typeof setTimeout>|undefined,ping:ReturnType<typeof setInterval>|undefined,tries=0;
  const seen=new Map<string,FlowTrade>();let since=Date.now();
  setState({trades:[],connected:false,error:null,since});
  const connect=()=>{
   if(closed)return;
   const socket=new WebSocket('wss://stream.bybit.com/v5/public/spot');ws=socket;
   socket.onopen=()=>{if(closed||ws!==socket)return;tries=0;setState(s=>({...s,connected:true,error:null}));socket.send(JSON.stringify({op:'subscribe',args:['publicTrade.'+symbol]}));ping=setInterval(()=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({op:'ping'}));},20000);};
   socket.onmessage=e=>{if(closed||ws!==socket)return;try{
    const packet=JSON.parse(String(e.data)) as {topic?:string;data?:Array<{i?:string;T?:number;p?:string;v?:string;S?:string;s?:string}>};
    if(packet.topic!=='publicTrade.'+symbol||!Array.isArray(packet.data))return;
    let changed=false;
    for(const t of packet.data){
     if(t.s!==symbol||(t.S!=='Buy'&&t.S!=='Sell'))continue;
     const price=Number(t.p),quantity=Number(t.v),timestamp=Number(t.T);
     if(!Number.isFinite(price)||price<=0||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(timestamp)||timestamp<=0)continue;
     const id=String(t.i||[timestamp,t.p,t.v,t.S].join(':'));
     if(seen.has(id))continue;
     seen.set(id,{id,price,quantity,timestamp,side:t.S});changed=true;
    }
    if(!changed)return;
    const cutoff=Date.now()-3600000;
    for(const [id,t] of seen)if(t.timestamp<cutoff)seen.delete(id);
    // Guard the browser against unusually active symbols.
    if(seen.size>12000)for(const id of [...seen.keys()].slice(0,seen.size-12000))seen.delete(id);
    setState(s=>({...s,trades:[...seen.values()].sort((a,b)=>a.timestamp-b.timestamp),since}));
   }catch{/* Ignore malformed public packets */}};
   socket.onerror=()=>{if(!closed)setState(s=>({...s,error:'Public trade stream connection error'}));};
   socket.onclose=()=>{if(ping)clearInterval(ping);if(closed)return;setState(s=>({...s,connected:false,error:'Reconnecting…'}));retry=setTimeout(connect,Math.min(30000,1000*2**Math.min(5,tries++)));};
  };
  connect();
  return()=>{closed=true;if(retry)clearTimeout(retry);if(ping)clearInterval(ping);if(ws){ws.onclose=null;ws.close();}};
 },[symbol]);
 return state;
}
