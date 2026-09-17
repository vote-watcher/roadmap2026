(function(){
  const fields=[...document.querySelectorAll('[data-print]')];
  const inputs=[...document.querySelectorAll('input,textarea,select')];
  const value=id=>{const el=document.getElementById(id);return el?el.value.trim():''};
  const isSeptember2026=value=>{const match=/^2026-09-(\d{2})$/.exec(value);return Boolean(match&&Number(match[1])>=1&&Number(match[1])<=30)};
  const formatDate=value=>isSeptember2026(value)?value.slice(-2):'';
  const formatTime=value=>{if(!value)return '';const [hours,minutes]=value.split(':');return `${hours} часов ${minutes} минут`};
  const optionalFragments=new WeakMap();
  function sync(){fields.forEach(el=>{const raw=value(el.dataset.print);const printed=el.dataset.printDate?formatDate(raw):el.dataset.printTime?formatTime(raw):raw;if(el.dataset.print==='serial'){const paragraph=el.closest('p');if(paragraph)paragraph.hidden=!printed}if(el.dataset.print==='actDate'){let fragment=optionalFragments.get(el);if(!fragment){fragment={before:el.previousSibling,beforeText:el.previousSibling.textContent,after:el.nextSibling,afterText:el.nextSibling.textContent};optionalFragments.set(el,fragment)}fragment.before.textContent=printed?fragment.beforeText:fragment.beforeText.replace(/\s*«\s*$/,'');fragment.after.textContent=printed?fragment.afterText:fragment.afterText.replace(/^»\s*сентября 2026\s*/,'');el.hidden=!printed}el.textContent=printed})}
  function validate(){const field=inputs.find(el=>(el.required||el.dataset.required==='true')&&!value(el.id));if(field){const label=document.querySelector(`label[for="${field.id}"]`);window.alert(`Заполните обязательное поле: ${label?label.textContent.trim():field.id}`);field.focus();return false}const invalidDate=inputs.find(el=>el.type==='date'&&value(el.id)&&(!isSeptember2026(value(el.id))||value(el.id)<el.min||value(el.id)>el.max));if(invalidDate){const label=document.querySelector(`label[for="${invalidDate.id}"]`);window.alert(`Укажите дату в сентябре 2026 года: ${label?label.textContent.trim():invalidDate.id}`);invalidDate.focus();return false}return true}
  window.fillExample=function(){const data=JSON.parse(document.body.dataset.example||'{}');Object.keys(data).forEach(id=>{const el=document.getElementById(id);if(el)el.value=data[id]});sync()};
  window.clearForm=function(){inputs.forEach(el=>{el.value=''});sync()};
  window.generatePDF=function(){if(!validate())return;sync();window.print()};
  inputs.forEach(el=>el.addEventListener('input',sync));
  inputs.forEach(el=>el.addEventListener('change',sync));
  sync();
})();
