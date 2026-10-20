import { useEffect, useState } from 'react';

export type Level = { price: number; amount: number; total: number };
export type PublicTrade = { id: string; price: number; amount: number; side: 'Buy' | 'Sell'; timestamp: number };
export type BookState = {
  asks: Level[]; bids: Level[]; trades: PublicTrade[];
  connected: boolean; synchronized: boolean; updatedAt: number; error: string | null;
};
const empty = (): BookState => ({ asks: [], bids: [], trades: [], connected: false, synchronized: false, updatedAt: 0, error: null });
type DepthMessage = { topic?: string; type?: string; data?: { s?: string; u?: number; seq?: number; a?: string[][]; b?: string[][] } };
type TradesMessage = { topic?: string; data?: Array<{ i?: string; T?: number; p?: string; v?: string; S?: string; s?: string }> };
function levels(book: Map<number,number>, descending: boolean): Level[] {
  let total = 0;
  return [...book.entries()].sort((a,b)=>descending?b[0]-a[0]:a[0]-b[0]).slice(0,50).map(([price,amount])=>{
    total += price*amount;
    return { price, amount, total };
  });
}
function apply(book: Map<number,number>, rows: string[][]): void {
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const price=Number(row[0]), amount=Number(row[1]);
    if (!Number.isFinite(price)||!Number.isFinite(amount)||price<=0||amount<0) continue;
    if (amount===0) book.delete(price); else book.set(price,amount);
  }
}
export function useBybitSpotBook(symbol = 'BTCUSDT'): BookState {
  const [state,setState]=useState<BookState>(empty);
  useEffect(()=>{
    if (!/^[A-Z0-9]{3,30}$/.test(symbol)) return;
    let disposed=false;
    let socket: WebSocket | null=null;
    let retry:ReturnType<typeof setTimeout> | undefined;
    let ping:ReturnType<typeof setInterval> | undefined;
    let reconnects=0;
    let lastSeq=-1, ready=false;
    const asks=new Map<number,number>(), bids=new Map<number,number>();
    const reset=()=>{
      asks.clear();bids.clear();lastSeq=-1;ready=false;
      setState(old=>({ ...empty(), trades:old.trades, error:null }));
    };
    const connect=()=>{
      if(disposed)return;
      reset();
      const ws=new WebSocket('wss://stream.bybit.com/v5/public/spot');
      socket=ws;
      ws.onopen=()=>{
        if(disposed||socket!==ws)return;
        reconnects=0;
        setState(s=>({...s, connected:true,error:null}));
        ws.send(JSON.stringify({op:'subscribe',args:['orderbook.50.'+symbol,'publicTrade.'+symbol]}));
        ping=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({op:'ping'}));},20000);
      };
      ws.onmessage=(event:MessageEvent)=>{
        if(disposed||socket!==ws)return;
        try {
          const raw=JSON.parse(String(event.data)) as DepthMessage & TradesMessage;
          if(raw.topic==='orderbook.50.'+symbol && raw.data && !Array.isArray(raw.data)){
            const d=raw.data as NonNullable<DepthMessage['data']>;
            if(d.s!==symbol||!Array.isArray(d.a)||!Array.isArray(d.b))return;
            if(raw.type==='snapshot'){
              asks.clear();bids.clear();apply(asks,d.a);apply(bids,d.b);
              ready=true;lastSeq=typeof d.seq==='number'?d.seq:-1;
            }else if(raw.type==='delta'){
              if(!ready)return; // Do not apply deltas without a valid snapshot
              if(typeof d.seq==='number'&&lastSeq>=0&&d.seq<=lastSeq)return;
              apply(asks,d.a);apply(bids,d.b);
              if(typeof d.seq==='number')lastSeq=d.seq;
            }else return;
            const sortedAsks=levels(asks,false), sortedBids=levels(bids,true);
            // An inconsistent/crossed book is not presented as valid live depth.
            if(sortedAsks.length&&sortedBids.length&&sortedBids[0].price>=sortedAsks[0].price)return;
            setState(s=>({...s,asks:sortedAsks,bids:sortedBids,synchronized:true,updatedAt:Date.now(),error:null}));
          }else if(raw.topic==='publicTrade.'+symbol&&Array.isArray(raw.data)){
            const incoming=(raw.data as NonNullable<TradesMessage['data']>).filter(x=>x.s===symbol&&Number(x.p)>0&&Number(x.v)>0&&(x.S==='Buy'||x.S==='Sell'))
              .map(x=>({id:String(x.i||[x.T,x.p,x.v,x.S].join(':')),price:Number(x.p),amount:Number(x.v),side:x.S as 'Buy'|'Sell',timestamp:Number(x.T)||Date.now()}));
            if(!incoming.length)return;
            setState(s=>{
              const unique=new Map<string,PublicTrade>();
              for(const trade of [...incoming,...s.trades])if(!unique.has(trade.id))unique.set(trade.id,trade);
              return {...s,trades:[...unique.values()].sort((a,b)=>b.timestamp-a.timestamp).slice(0,80)};
            });
          }
        } catch { /* Ignore malformed external messages. */ }
      };
      ws.onerror=()=>{if(socket===ws&&!disposed)setState(s=>({...s,error:'Public Bybit stream connection error'}));};
      ws.onclose=()=>{
        if(disposed||socket!==ws)return;
        socket=null;
        if(ping)clearInterval(ping);
        setState(s=>({...s,connected:false,synchronized:false,asks:[],bids:[],error:'Reconnecting to public Bybit stream…'}));
        retry=setTimeout(connect,Math.min(30000,1000*Math.pow(2,Math.min(reconnects++,5))));
      };
    };
    connect();
    return ()=>{disposed=true;if(retry)clearTimeout(retry);if(ping)clearInterval(ping);if(socket){socket.onclose=null;socket.close();}};
  },[symbol]);
  return state;
}
