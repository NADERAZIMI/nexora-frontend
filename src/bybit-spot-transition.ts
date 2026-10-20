/** Transition shell: prevent saved MEXC numbers from appearing live while Bybit integrations arrive. */
export function attachBybitSpotTransition(root:HTMLElement):()=>void {
 const chart=root.querySelector<HTMLElement>('[class*="__chartWrapper"]');
 const book=root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
 const name=root.querySelector<HTMLElement>('[class*="__symbolInfoBox"] h1');
 const clickable=root.querySelector<HTMLElement>('[class*="__symbolInfoBox"] [class*="__bigName"]');
 const label=root.querySelector<HTMLElement>('[class*="__fullName"]');
 const chartPlaceholder=document.createElement('div');
 chartPlaceholder.className='nexora-bybit-pending nexora-bybit-chart-pending';
 chartPlaceholder.textContent='NEXORA · Bybit chart integration in progress';
 chart?.append(chartPlaceholder);
 const bookPlaceholder=document.createElement('div');
 bookPlaceholder.className='nexora-bybit-pending nexora-bybit-book-pending';
 bookPlaceholder.textContent='NEXORA · Bybit order book integration in progress';
 book?.append(bookPlaceholder);
 const picker=document.createElement('form');
 picker.className='nexora-bybit-symbol-picker';
 picker.hidden=true;
 picker.innerHTML='<label for="nexora-bybit-symbol">Bybit Spot symbol</label><input id="nexora-bybit-symbol" name="symbol" value="BTCUSDT" maxlength="30" placeholder="ETHUSDT" autocomplete="off"><button type="submit">Select</button><small>Symbols are validated by the live Bybit ticker stream.</small>';
 document.body.append(picker);
 const input=picker.querySelector<HTMLInputElement>('input')!;
 const submit=(event:Event)=>{
  event.preventDefault();
  const symbol=input.value.trim().toUpperCase();
  if(!/^[A-Z0-9]{3,30}$/.test(symbol)){input.setCustomValidity('Enter a valid symbol');input.reportValidity();return}
  input.setCustomValidity('');
  picker.hidden=true;
  const quote=['USDT','USDC','BTC','ETH'].find(x=>symbol.endsWith(x))??'USDT';
  const base=symbol.endsWith(quote)?symbol.slice(0,-quote.length):symbol;
  if(name)name.textContent=base+'/'+quote;
  if(label)label.textContent='Bybit Spot';
  root.dispatchEvent(new CustomEvent('nexora:market-selected',{detail:{symbol,base,quote,category:'spot'}}));
 };
 const toggle=(e:Event)=>{e.preventDefault();e.stopPropagation();picker.hidden=!picker.hidden;if(!picker.hidden)input.focus()};
 const outside=(e:MouseEvent)=>{if(!picker.contains(e.target as Node)&&!clickable?.contains(e.target as Node))picker.hidden=true};
 const search=(e:Event)=>{const value=(e as CustomEvent<{query?:string}>).detail?.query;input.value=value?.trim().toUpperCase()??'';picker.hidden=false;input.focus()};
 picker.addEventListener('submit',submit);
 clickable?.addEventListener('click',toggle);
 document.addEventListener('click',outside);
 root.addEventListener('nexora:open-market-search',search);
 return ()=>{chartPlaceholder.remove();bookPlaceholder.remove();picker.remove();picker.removeEventListener('submit',submit);clickable?.removeEventListener('click',toggle);document.removeEventListener('click',outside);root.removeEventListener('nexora:open-market-search',search)};
}
