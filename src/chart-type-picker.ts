import { isDirectChartType } from './chart-renderers';
/** Compact chart type selector, limited to the seven approved rendering modes. */
export function attachChartTypePicker(topRow:HTMLElement,onChange:(type:string)=>void):()=>void {
 const TYPES=[
  ['Bars','Bars'],['Candles','Candles'],['Hollow candles','Hollow Candles'],
  ['Heikin Ashi','Heikin Ashi'],['Line','Line'],['Area','Area'],['Baseline','Baseline']
 ] as const;
 const key='nexora-spot-chart-type';
 let current='Candles';
 try{const saved=localStorage.getItem(key);if(saved&&TYPES.some(t=>t[0]===saved))current=saved}catch{}
 const wrap=document.createElement('div');wrap.className='nexora-chart-type-picker';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='nexora-chart-type-trigger';
 trigger.setAttribute('aria-label','Chart type');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
 const glyph=document.createElement('span');glyph.className='nexora-chart-type-glyph';glyph.setAttribute('aria-hidden','true');
 for(let i=0;i<2;i++){const bar=document.createElement('i');glyph.append(bar)}
 trigger.append(glyph);
 const menu=document.createElement('div');menu.className='nexora-chart-type-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Choose chart type');menu.hidden=true;
 TYPES.forEach(([id,label],index)=>{
  const item=document.createElement('button');item.type='button';item.className='nexora-chart-type-item';item.setAttribute('role','menuitemradio');
  const icon=document.createElement('span');icon.className='nexora-chart-type-item-icon';icon.textContent=index<4?'♜':'⌁';
  const text=document.createElement('span');text.textContent=label;
  item.append(icon,text);
  item.dataset.chartType=id;
  if(!isDirectChartType(id)){item.disabled=true;item.title='Requires additional market data or a dedicated transformation engine';item.setAttribute('aria-disabled','true');}
  item.addEventListener('click',e=>{e.stopPropagation();current=id;try{localStorage.setItem(key,id)}catch{}
   renderSelection();onChange(id);setOpen(false);
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
 renderSelection();onChange(current);
 return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keydown);wrap.remove()};
}
