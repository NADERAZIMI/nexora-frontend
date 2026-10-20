import {useState} from 'react';
const maps:Record<string,string>={BTC:'bitcoin',ETH:'ethereum',USDT:'tether',USDC:'usd-coin',SOL:'solana',XRP:'ripple',BNB:'binancecoin',DOGE:'dogecoin',ADA:'cardano',TRX:'tron',DOT:'polkadot',LTC:'litecoin',BCH:'bitcoin-cash',LINK:'chainlink',AVAX:'avalanche-2',SHIB:'shiba-inu',PEPE:'pepe',TON:'the-open-network',SUI:'sui',NEAR:'near',APT:'aptos',ARB:'arbitrum',OP:'optimism',UNI:'uniswap',ATOM:'cosmos',ETC:'ethereum-classic',FIL:'filecoin',AAVE:'aave',XLM:'stellar',XMR:'monero',INJ:'injective-protocol',WIF:'dogwifcoin',BONK:'bonk',HBAR:'hedera-hashgraph'};
export function TokenIcon({symbol}:{symbol:string}){
 const [failed,setFailed]=useState(false);
 const id=maps[symbol.toUpperCase()];
 return <span className="market-token-icon" aria-label={symbol+' logo'}>
 {id&&!failed?<img loading="lazy" alt="" src={'https://assets.coingecko.com/coins/images/'+({
 bitcoin:'1',ethereum:'279',tether:'325',solana:'4128',ripple:'44',binancecoin:'825',dogecoin:'5',cardano:'975',tron:'1094',polkadot:'12171',litecoin:'2','bitcoin-cash':'780',chainlink:'877','usd-coin':'6319'
 } as Record<string,string>)[id]+'/small/'+id+'.png'} onError={()=>setFailed(true)}/>:<span>{symbol.slice(0,1)}</span>}
 </span>;
}
