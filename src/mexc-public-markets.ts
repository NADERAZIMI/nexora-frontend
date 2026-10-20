/** Frontend-development-only public MEXC Spot discovery: no credentials, no backend writes. */
export interface MexcSpotMarket { id:string; symbol:string; quote:string; price:string; change24h:number|null; status:string }
type ExchangeSymbol={symbol?:unknown;baseAsset?:unknown;quoteAsset?:unknown;status?:unknown};
type PriceTicker={symbol?:unknown;price?:unknown};
type ChangeTicker={symbol?:unknown;priceChangePercent?:unknown};
const positive=(v:unknown):v is string=>typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v)&&/[1-9]/.test(v);
async function request(path:string,signal?:AbortSignal):Promise<unknown> {
 const response=await fetch('/mexc-public/api/v3/'+path,{signal,credentials:'omit',headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('MEXC public '+path+' HTTP '+response.status);
 const json=await response.json() as unknown;
 if(json&&typeof json==='object'&&'code' in json&&!('symbols' in json))throw Error('MEXC public '+path+' error '+String(json.code));
 return json;
}
export async function getMexcSpotMarkets(signal?:AbortSignal):Promise<MexcSpotMarket[]>{
 // A failing ticker endpoint MUST NOT hide the whole asset catalog.
 const info=await request('exchangeInfo',signal);
 if(!info||typeof info!=='object'||!('symbols' in info)||!Array.isArray(info.symbols))throw Error('MEXC returned no spot market catalog');
 const symbols=info.symbols as ExchangeSymbol[];
 const prices=new Map<string,string>();
 try{
  const tickers=await request('ticker/price',signal);
  if(Array.isArray(tickers))for(const row of tickers as PriceTicker[]){
   if(typeof row.symbol==='string'&&positive(row.price))prices.set(row.symbol,row.price);
  }
 }catch(error){if(signal?.aborted)throw error;console.warn('[NEXORA demo] MEXC ticker unavailable; symbols remain visible',error);}
 const changes=new Map<string,number>();
 try {
  const rows=await request('ticker/24hr',signal);
  if(Array.isArray(rows))for(const row of rows as ChangeTicker[]) {
   const change=Number(row.priceChangePercent);
   if(typeof row.symbol==='string'&&row.priceChangePercent!==undefined&&row.priceChangePercent!==null&&Number.isFinite(change))changes.set(row.symbol,change*100);
  }
 }catch(error){if(signal?.aborted)throw error;console.warn('[NEXORA] 24h change unavailable',error);}
 const result:MexcSpotMarket[]=[];
 const seen=new Set<string>();
 for(const raw of symbols){
  if(typeof raw.symbol!=='string'||typeof raw.baseAsset!=='string'||typeof raw.quoteAsset!=='string')continue;
  const id=raw.symbol.toUpperCase(),symbol=raw.baseAsset.toUpperCase(),quote=raw.quoteAsset.toUpperCase();
  if(!/^[A-Z0-9]{2,40}$/.test(id)||seen.has(id))continue;
  const status=String(raw.status??'');
  if(status&&status!=='1'&&!['ENABLED','TRADING','TRUE'].includes(status.toUpperCase()))continue;
  seen.add(id);
  result.push({id,symbol,quote,price:prices.get(raw.symbol)??'',change24h:changes.get(raw.symbol)??null,status});
 }
 if(!result.length)throw Error('MEXC catalog contained no supported Spot symbols');
 return result;
}
