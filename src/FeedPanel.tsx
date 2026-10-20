import {useEffect,useMemo,useState} from 'react';
import './FeedPanel.css';

type Category='News'|'Token News'|'Macro News'|'Market Trend'|'Calendar';
type Sentiment='bullish'|'bearish'|'neutral';
type Article={id:string;title:string;source:string;publishedAt:string;category:Category;summary?:string;body?:string;url?:string;sentiment?:Sentiment;symbols?:string[]};
const categories:Category[]=['News','Token News','Macro News','Market Trend','Calendar'];
const isArticle=(v:unknown):v is Article=>{
 if(!v||typeof v!=='object')return false;
 const a=v as Partial<Article>;
 return typeof a.id==='string'&&typeof a.title==='string'&&typeof a.source==='string'&&typeof a.publishedAt==='string'&&categories.includes(a.category as Category);
};
function safeUrl(value:string|undefined){if(!value)return null;try{const x=new URL(value);return x.protocol==='https:'?x.toString():null;}catch{return null;}}
function utc(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toISOString().slice(0,16).replace('T',' ')+' (UTC)';}
export default function FeedPanel({symbol}:{symbol:string}){
 const [category,setCategory]=useState<Category>('News');
 const [articles,setArticles]=useState<Article[]>([]);
 const [status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading');
 const [visible,setVisible]=useState(6);
 const [selected,setSelected]=useState<Article|null>(null);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  const controller=new AbortController();setStatus('loading');
  // A one-time snapshot request; real article ingestion/updates belong to NEXORA's backend.
  fetch('/api/public/feed',{signal:controller.signal,credentials:'omit'}).then(async r=>{
   if(!r.ok)throw Error('News service is not connected');
   const payload=await r.json() as {articles?:unknown[]};
   if(!Array.isArray(payload.articles))throw Error('Invalid news feed response');
   setArticles(payload.articles.filter(isArticle).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)));setStatus('ready');setError(null);
  }).catch(e=>{if(!controller.signal.aborted){setStatus('unavailable');setError(e instanceof Error?e.message:'News unavailable');}});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{if(!selected)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setSelected(null);};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[selected]);
 const filtered=useMemo(()=>articles.filter(a=>category==='News'||a.category===category),[articles,category]);
 const shown=filtered.slice(0,visible);
 const tab=(name:Category)=>{setCategory(name);setVisible(6);setSelected(null);};
 return <div className="feed-screen">
  <nav className="feed-filters" aria-label="News categories">{categories.map((c,i)=><button type="button" key={c} onClick={()=>tab(c)} className={category===c?'active':''}>{c}</button>)}</nav>
  <h3>{category==='News'?'Latest News':category}</h3>
  <div className="feed-news-list">
   {category==='News'&&<div className="feed-ai-banner"><span>✧ AI analysis</span><small>Available when verified analysis is connected</small></div>}
   {status==='loading'?<p className="feed-empty">Loading news…</p>:status==='unavailable'?<div className="feed-empty"><strong>News feed is not connected yet.</strong><p>Connect the NEXORA news service to display verified articles, sources and publication dates.</p><small>{error}</small></div>:shown.length===0?<p className="feed-empty">No verified {category.toLowerCase()} articles available.</p>:shown.map(a=><button type="button" className="feed-story" key={a.id} onClick={()=>setSelected(a)}>
    <div className="feed-story-meta"><span>{utc(a.publishedAt)}</span><span>{a.source}</span>{a.sentiment&&<span className={'feed-sentiment '+a.sentiment}>{a.sentiment}</span>}</div>
    <div className="feed-story-title"><strong>{a.title}</strong><span aria-hidden="true">›</span></div>
   </button>)}
  </div>
  {status==='ready'&&visible<filtered.length&&<div className="feed-more"><button type="button" onClick={()=>setVisible(v=>v+6)}>Show more</button></div>}
  {selected&&<div className="feed-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
   <div className="feed-modal" role="dialog" aria-modal="true" aria-label="News">
    <div className="feed-modal-heading"><h3>News</h3><button type="button" aria-label="Close news" onClick={()=>setSelected(null)}>×</button></div>
    <div className="feed-modal-body"><div className="feed-story-meta"><span>{utc(selected.publishedAt)}</span><span>{selected.source}</span>{selected.sentiment&&<span className={'feed-sentiment '+selected.sentiment}>{selected.sentiment}</span>}</div>
    <h2>{selected.title}</h2><p>{selected.body||selected.summary||'Full text is available from the original source.'}</p>
    {safeUrl(selected.url)&&<a className="feed-source-link" href={safeUrl(selected.url)!} target="_blank" rel="noopener noreferrer">↗ View source</a>}
    <p className="feed-disclaimer">News and commentary are provided for information only, not investment advice.</p></div>
   </div>
  </div>}
 </div>;
}
