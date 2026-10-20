/** Optional CoinGecko public metadata. Explicit coin IDs avoid ambiguous ticker matches. */
export type CoinProfile={
 name:string; image:string; rank:number|null; marketCap:number|null; fdv:number|null;
 circulating:number|null; total:number|null; max:number|null; ath:number|null; atl:number|null;
 description:string; homepage:string; explorer:string; twitter:string; telegram:string; reddit:string; github:string;
};
const IDS:Readonly<Record<string,string>>={
 '1INCH':'1inch',BTC:'bitcoin',ETH:'ethereum',SOL:'solana',BNB:'binancecoin',XRP:'ripple',
 DOGE:'dogecoin',ADA:'cardano',AVAX:'avalanche-2',DOT:'polkadot',LINK:'chainlink',
 LTC:'litecoin',BCH:'bitcoin-cash',TRX:'tron',SHIB:'shiba-inu',PEPE:'pepe',
 UNI:'uniswap',XLM:'stellar',SHIDO:'shido-2',USDT:'tether',USDC:'usd-coin',
 TON:'the-open-network',ATOM:'cosmos',NEAR:'near',ETC:'ethereum-classic'
};
const cache=new Map<string,{at:number;value:CoinProfile|null}>();
type CoinListItem={id?:unknown;symbol?:unknown;name?:unknown};
let listCache:{at:number;unique:Map<string,string>}|null=null;
let listLoading:Promise<Map<string,string>>|null=null;
async function uniqueCoinIds():Promise<Map<string,string>>{
 if(listCache&&Date.now()-listCache.at<24*3600000)return listCache.unique;
 if(!listLoading)listLoading=(async()=>{
  const response=await fetch('/coingecko-public/api/v3/coins/list?include_platform=false',{credentials:'omit'});
  if(!response.ok)throw new Error('CoinGecko coin list HTTP '+response.status);
  const data=await response.json() as unknown;
  if(!Array.isArray(data))throw new Error('Invalid CoinGecko coin list');
  const unique=new Map<string,string>(),duplicates=new Set<string>();
  for(const item of data as CoinListItem[]){
   if(typeof item.symbol!=='string'||typeof item.id!=='string'||!item.name)continue;
   const symbol=item.symbol.toUpperCase();
   if(!/^[A-Z0-9]{2,40}$/.test(symbol))continue;
   if(unique.has(symbol)){unique.delete(symbol);duplicates.add(symbol);}
   else if(!duplicates.has(symbol))unique.set(symbol,item.id);
  }
  listCache={at:Date.now(),unique};
  return unique;
 })().finally(()=>{listLoading=null});
 return listLoading;
}
const num=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const str=(v:unknown):string=>typeof v==='string'?v:'';
const url=(v:unknown):string=>{const s=str(v);try {return new URL(s).protocol==='https:'?s:''}catch{return ''}};
const first=(v:unknown):string=>Array.isArray(v)?str(v.find(x=>typeof x==='string'&&x.startsWith('https://'))):'';
type Payload={symbol?:unknown;name?:unknown;image?:{small?:unknown};market_cap_rank?:unknown;description?:{en?:unknown};links?:{
 homepage?:unknown;blockchain_site?:unknown;twitter_screen_name?:unknown;telegram_channel_identifier?:unknown;subreddit_url?:unknown;repos_url?:{github?:unknown}
};market_data?:{market_cap?:{usd?:unknown};fully_diluted_valuation?:{usd?:unknown};circulating_supply?:unknown;total_supply?:unknown;max_supply?:unknown;ath?:{usd?:unknown};atl?:{usd?:unknown}}};
export async function getCoinProfile(base:string,signal:AbortSignal):Promise<CoinProfile|null>{
 const symbol=base.toUpperCase();
 let id: string | undefined=IDS[symbol];
 if(!id){
  // Only use an automatic ID when exactly one CoinGecko asset has this ticker.
  const unique=await uniqueCoinIds();
  id=unique.get(symbol);
 }
 if(!id)return null;
 const hit=cache.get(id);if(hit&&Date.now()-hit.at<3600000)return hit.value;
 // The NEXORA reverse proxy attaches the configured Demo API key.
 const response=await fetch('/coingecko-public/api/v3/coins/'+encodeURIComponent(id)+'?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false',{signal,headers:{Accept:'application/json'},credentials:'omit'});
 if(!response.ok)throw new Error('CoinGecko metadata unavailable (HTTP '+response.status+')');
 const d=await response.json() as Payload;
 if(str(d.symbol).toUpperCase()!==symbol)throw new Error('CoinGecko symbol mismatch');
 const m=d.market_data,l=d.links;
 const desc=str(d.description?.en).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const twitter=str(l?.twitter_screen_name).replace(/^@/,'');
 const telegram=str(l?.telegram_channel_identifier);
 const profile:CoinProfile={
  name:str(d.name)||base,image:url(d.image?.small),rank:num(d.market_cap_rank),
  marketCap:num(m?.market_cap?.usd),fdv:num(m?.fully_diluted_valuation?.usd),
  circulating:num(m?.circulating_supply),total:num(m?.total_supply),max:num(m?.max_supply),
  ath:num(m?.ath?.usd),atl:num(m?.atl?.usd),description:desc,
  homepage:url(first(l?.homepage)),explorer:url(first(l?.blockchain_site)),
  twitter:twitter?'https://x.com/'+encodeURIComponent(twitter):'',
  telegram:telegram?'https://t.me/'+encodeURIComponent(telegram):'',
  reddit:url(l?.subreddit_url),github:url(first(l?.repos_url?.github))
 };
 cache.set(id,{at:Date.now(),value:profile});return profile;
}
