import {useEffect,useState} from 'react';
/** Logos are served from NEXORA's own release assets, not remote hosts. */
export function TokenIcon({symbol}:{symbol:string}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[symbol]);
 const code=symbol.toLowerCase();
 return <span className="market-token-icon" aria-label={symbol+' logo'}>
 {!failed?<img loading="lazy" alt="" src={'/token-icons/'+encodeURIComponent(code)+'.png'} onError={()=>setFailed(true)}/>:<span>{symbol.slice(0,1)}</span>}
 </span>;
}
