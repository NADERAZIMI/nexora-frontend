/** Replace only the captured chart header tabs; preserve other panels and live feeds. */
export function attachSpotChartTabs(root:HTMLElement):()=>void{
 const header=root.querySelector<HTMLElement>('[class*="__chartWrapper"] [class*="__chartHeader"]');
 const original=header?.querySelector<HTMLElement>('[role="tablist"]');
 if(!header||!original)return ()=>{};
 const oldDisplay=original.style.display;
 original.style.display='none';
 const nav=document.createElement('div');nav.className='nexora-chart-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Spot chart sections');
 const names=['Chart','Overview','Data','Feed','Trade Analysis'] as const;
 const buttons=names.map((name,i)=>{
  const button=document.createElement('button');button.type='button';button.textContent=name;button.setAttribute('role','tab');
  button.setAttribute('aria-selected',String(i===0));button.tabIndex=i===0?0:-1;
  nav.append(button);return button;
 });
 const chart=header.closest<HTMLElement>('[class*="__chartWrapper"]');
 const placeholder=document.createElement('div');placeholder.className='nexora-chart-tab-placeholder';placeholder.hidden=true;
 placeholder.setAttribute('role','tabpanel');placeholder.setAttribute('aria-live','polite');
 chart?.append(placeholder);
 const select=(index:number)=>{
  buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1});
  placeholder.hidden=index===0;
  if(index!==0)placeholder.textContent='NEXORA · '+names[index]+' integration in progress';
 };
 const handlers=buttons.map((button,index)=>{
  const handler=(event:MouseEvent)=>{event.preventDefault();event.stopPropagation();select(index)};
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight'&&event.key!=='Home'&&event.key!=='End')return;
   event.preventDefault();event.stopPropagation();
   const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
   select(next);buttons[next].focus();
  };
  button.addEventListener('click',handler);button.addEventListener('keydown',keyboard);
  return ()=>{button.removeEventListener('click',handler);button.removeEventListener('keydown',keyboard)};
 });
 header.prepend(nav);
 return ()=>{handlers.forEach(x=>x());nav.remove();placeholder.remove();original.style.display=oldDisplay};
}
