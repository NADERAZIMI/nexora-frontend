import {useEffect,useState} from 'react';
/** Public open-source cryptocurrency-icons artwork. Unknown assets fall back to a letter. */
export function TokenIcon({symbol}:{symbol:string}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[symbol]);
 const code=symbol.toLowerCase();
 return <span className="market-token-icon" aria-label={symbol+' logo'}>
 {!failed?<img loading="lazy" alt="" src={'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/'+encodeURIComponent(code)+'.png'} onError={()=>setFailed(true)}/>:<span>{symbol.slice(0,1)}</span>}
 </span>;
}
