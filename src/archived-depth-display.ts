import { ARCHIVED_DEPTH } from './archived-depth';
import { formatPrice } from './price-precision';

/** Swaps only saved DOM text values. No fabricated trades or network requests. */
export function attachArchivedDepth(root:HTMLElement) {
  const book=root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
  if(!book) return {select:(_id:string)=>{},dispose:()=>{}};
  type Cell={node:HTMLElement,original:string};
  const cells:Cell[]=[];
  const remember=(node:HTMLElement|null)=>{
    if(!node) return;
    if(!cells.some(x=>x.node===node))cells.push({node,original:node.textContent??''});
  };
  const rows=(side:'asks'|'bids')=>Array.from(book.querySelectorAll<HTMLElement>('[class*="__'+side+'Wrapper"] [class*="__tableRow"]'));
  const price=book.querySelector<HTMLElement>('[class*="__newPrice"] [class*="__bigPrice"] [class*="__priceEllipsis"]');
  const precision=book.querySelector<HTMLElement>('[class*="__settingWrapper"] [class*="__drop"] > span');
  const unit=book.querySelector<HTMLElement>('[class*="__tableHeader"] h2[class*="__vol"] [class*="__ellipsisLabel"]');
  remember(price);remember(precision);remember(unit);
  const originalRows={asks:rows('asks'),bids:rows('bids')};
  const captured=['asks','bids'] as const;
  for(const side of captured)for(const row of originalRows[side])for(const key of ['price','vol','amount']){
    remember(row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__'+key+'"]'));
  }
  const restore=()=>cells.forEach(x=>{x.node.textContent=x.original});
  const select=(id:string)=>{
    restore();
    if(id==='BTC_USDT')return;
    const depth=ARCHIVED_DEPTH[id];
    if(!depth)return;
    if(price)price.textContent=formatPrice(depth.mid);
    if(precision)precision.textContent=formatPrice(depth.precision);
    if(unit)unit.textContent=id.split('_')[0];
    for(const side of captured)originalRows[side].forEach((row,i)=>{
      const data=depth[side][i];
      if(!data)return;
      for(const [key,value] of [['price',data[0]],['vol',data[1]],['amount',data[2]]] as const){
        const node=row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__'+key+'"]');
        if(node){const dest=key==='price'?node:(node.querySelector('span')??node);dest.textContent=value}
      }
    });
  };
  return {select,dispose:restore};
}
