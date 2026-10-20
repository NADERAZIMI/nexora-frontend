/** Visual-only chart-type selector. Rendering modes are intentionally not changed in this phase. */
export function attachChartTypePicker(topRow:HTMLElement):()=>void {
 const TYPES=[
  ['Bars','Bars'],['Candles','Candles'],['Hollow candles','Hollow candles'],['Volume candles','Volume candles'],
  ['Line','Line'],['Line with markers','Line with markers'],['Step line','Step line'],
  ['Area','Area'],['HLC area','HLC area'],['Baseline','Baseline'],
  ['Columns','Columns'],['High-low','High-low'],['Volume footprint','Volume footprint'],
  ['Time price opportunity','Time price opportunity'],['Session volume profile','Session volume profile'],
  ['Heikin Ashi','Heikin Ashi'],['Renko','Renko'],['Line break','Line break'],['Kagi','Kagi'],
  ['Point & figure','Point & figure'],['Range','Range']
 ] as const;
 const key='nexora-spot-chart-type';
 let current='Candles';
 try{const saved=localStorage.getItem(key);if(saved&&TYPES.some(t=>t[0]===saved))current=saved}catch{}
 const wrap=document.createElement('div');wrap.className='nexora-chart-type-picker';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='nexora-chart-type-trigger';
 trigger.setAttribute('aria-label','Chart type');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
 const glyph=document.createElement('span');glyph.className='nexora-chart-type-glyph';glyph.setAttribute('aria-hidden','true');
 for(let i=0;i<3;i++){const bar=document.createElement('i');glyph.append(bar)}
 const arrow=document.createElement('span');arrow.textContent='⌄';arrow.className='nexora-chart-type-chevron';
 trigger.append(glyph,arrow);
 const menu=document.createElement('div');menu.className='nexora-chart-type-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Choose chart type');menu.hidden=true;
 let previousGroup=0;
 const groups=[0,4,7,10,12,15,16];
 TYPES.forEach(([id,label],index)=>{
  if(groups.includes(index)&&index!==0){const divider=document.createElement('div');divider.className='nexora-chart-type-divider';menu.append(divider);previousGroup++}
  const item=document.createElement('button');item.type='button';item.className='nexora-chart-type-item';item.setAttribute('role','menuitemradio');
  const icon=document.createElement('span');icon.className='nexora-chart-type-item-icon';icon.textContent=index<4?'♜':index<10?'⌁':index<16?'▥':'♧';
  const text=document.createElement('span');text.textContent=label;
  item.append(icon,text);
  item.dataset.chartType=id;
  item.addEventListener('click',e=>{e.stopPropagation();current=id;try{localStorage.setItem(key,id)}catch{}
   renderSelection();setOpen(false);
  });
  menu.append(item);
 });
 const renderSelection=()=>{for(const item of menu.querySelectorAll<HTMLButtonElement>('button[data-chart-type]')){
   const chosen=item.dataset.chartType===current;
   item.setAttribute('aria-checked',String(chosen));item.classList.toggle('is-selected',chosen);
  }trigger.title='Chart type: '+current;};
 const setOpen=(open:boolean)=>{menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));};
 trigger.addEventListener('click',e=>{e.stopPropagation();setOpen(menu.hidden)});
 const outside=(e:PointerEvent)=>{if(!wrap.contains(e.target as Node))setOpen(false)};
 const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!menu.hidden){setOpen(false);trigger.focus()}};
 document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keydown);
 wrap.append(trigger,menu);
 const afterTimeframes=topRow.querySelector('.nexora-chart-timeframes');
 if(afterTimeframes)afterTimeframes.insertAdjacentElement('afterend',wrap);else topRow.append(wrap);
 renderSelection();
 return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keydown);wrap.remove()};
}
