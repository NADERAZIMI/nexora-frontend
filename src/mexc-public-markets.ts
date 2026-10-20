/** Public MEXC Spot market discovery (no credentials or order placement). */
export interface MexcSpotMarket {id:string;symbol:string;quote:string;price:string;status:string}
interface ExchangeSymbol {symbol?:unknown;baseAsset?:unknown;quoteAsset?:unknown;status?:unknown}
interface PriceTicker {symbol?:unknown;price?:unknown}
function isPositiveDecimal(v:unknown):v is string {
  return typeof v==='string' && /^\d+(?:\.\d+)?$/.test(v) && /[1-9]/.test(v);
}
async function request(path:string,signal?:AbortSignal):Promise<unknown> {
  const response=await fetch('/mexc-public/api/v3/'+path,{signal,credentials:'omit',headers:{Accept:'application/json'}});
  if(!response.ok) throw Error('MEXC public API unavailable ('+response.status+')');
  return response.json();
}
export async function getMexcSpotMarkets(signal?:AbortSignal):Promise<MexcSpotMarket[]> {
  const [info,prices]=await Promise.all([request('exchangeInfo',signal),request('ticker/price',signal)]);
  if(!info || typeof info!=='object' || !('symbols' in info) || !Array.isArray(info.symbols) || !Array.isArray(prices))
    throw Error('Unexpected MEXC public response');
  const latest=new Map<string,string>();
  for(const row of prices as PriceTicker[])if(typeof row.symbol==='string' && isPositiveDecimal(row.price))latest.set(row.symbol,row.price);
  const list:MexcSpotMarket[]=[];
  for(const raw of info.symbols as ExchangeSymbol[]){
    if(typeof raw.symbol!=='string'||typeof raw.baseAsset!=='string'||typeof raw.quoteAsset!=='string')continue;
    const price=latest.get(raw.symbol);
    if(!price)continue;
    // Don't substitute derivatives or assets whose quote cannot be established.
    const status=String(raw.status??'');
    if(status && status!=='1' && status.toUpperCase()!=='ENABLED' && status.toUpperCase()!=='TRADING')continue;
    list.push({id:raw.symbol,symbol:raw.baseAsset,quote:raw.quoteAsset,price,status});
  }
  return list;
}
