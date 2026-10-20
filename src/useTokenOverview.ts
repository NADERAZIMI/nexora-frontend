import {useEffect,useState} from 'react';
type OverviewInfo={description?:string;marketCap?:number;fdv?:number;circulating?:number;total?:number;max?:number;homepage?:string;explorers?:string[];whitepaper?:string;socials?:{github?:string;twitter?:string;reddit?:string}};
const ids:Record<string,string>={BTC:'bitcoin',ETH:'ethereum',SOL:'solana',XRP:'ripple',BNB:'binancecoin',DOGE:'dogecoin',ADA:'cardano',TRX:'tron',LTC:'litecoin',DOT:'polkadot',LINK:'chainlink',AVAX:'avalanche-2',SUI:'sui',SHIB:'shiba-inu',USDT:'tether',USDC:'usd-coin'};
export function useTokenOverview(base:string){
 const [info,setInfo]=useState<OverviewInfo|null>(null),[status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading');
 useEffect(()=>{
  setInfo(null);setStatus('loading');const id=ids[base.toUpperCase()];
  if(!id){setStatus('unavailable');return;}
  const controller=new AbortController();
  (async()=>{try{
    const url='https://api.coingecko.com/api/v3/coins/'+encodeURIComponent(id)+'?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false';
    const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw Error('Metadata unavailable');
    const d=await response.json() as any;const m=d.market_data||{},links=d.links||{};
    const safeLinks=(items:unknown)=>Array.isArray(items)?items.filter((v):v is string=>typeof v==='string'&&v.startsWith('https://')).slice(0,7):[];
    const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:undefined;
    setInfo({description:typeof d.description?.en==='string'?d.description.en.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():undefined,marketCap:num(m.market_cap?.usd),fdv:num(m.fully_diluted_valuation?.usd),circulating:num(m.circulating_supply),total:num(m.total_supply),max:num(m.max_supply),homepage:safeLinks(links.homepage)[0],explorers:safeLinks(links.blockchain_site),whitepaper:typeof links.whitepaper==='string'&&links.whitepaper.startsWith('https://')?links.whitepaper:undefined,socials:{github:safeLinks(links.repos_url?.github)[0],twitter:links.twitter_screen_name?'https://x.com/'+encodeURIComponent(links.twitter_screen_name):undefined,reddit:typeof links.subreddit_url==='string'&&links.subreddit_url.startsWith('https://')?links.subreddit_url:undefined}});
    setStatus('ready');
  }catch{if(!controller.signal.aborted)setStatus('unavailable');}})();
  return()=>controller.abort();
 },[base]);
 return {info,status};
}
