import {useEffect,useState} from 'react';
export type MarketTicker={lastPrice:number;change:number;turnover:number};
export function useSpotTickers(){
 const [tickers,setTickers]=useState<Record<string,MarketTicker>>({});
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let alive=true;const controller=new AbortController();
  const load=async()=>{
   for(const url of ['/bybit-public/v5/market/tickers?category=spot','https://api.bybit.com/v5/market/tickers?category=spot','https://api.bytick.com/v5/market/tickers?category=spot']){
    try{
     const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});
     if(!response.ok)continue;
     const json=await response.json() as {retCode?:number;result?:{list?:Array<{symbol?:string;lastPrice?:string;price24hPcnt?:string;turnover24h?:string}>}};
     if(json.retCode!==0||!Array.isArray(json.result?.list)||json.result.list.length<10)continue;
     const result:Record<string,MarketTicker>={};
     for(const x of json.result.list){
      const lastPrice=Number(x.lastPrice),change=Number(x.price24hPcnt),turnover=Number(x.turnover24h);
      if(x.symbol&&Number.isFinite(lastPrice)&&lastPrice>0&&Number.isFinite(change)&&Number.isFinite(turnover))result[x.symbol]={lastPrice,change,turnover};
     }
     if(alive){setTickers(result);setReady(true);}return;
    }catch{if(!alive)return;}
   }
  };
  void load();const timer=setInterval(()=>void load(),30000);
  return()=>{alive=false;controller.abort();clearInterval(timer);};
 },[]);
 return {tickers,ready};
}
