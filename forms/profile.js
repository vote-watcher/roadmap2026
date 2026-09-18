(function(){
  const COOKIE_NAME='vote_profile_v1';
  const MAX_LENGTH={fullName:160,uik:12};
  const attrs='Path=/; Max-Age=2592000; SameSite=Lax'+(window.location.protocol==='https:'?'; Secure':'');
  const getCookie=()=>{const item=document.cookie.split('; ').find(value=>value.startsWith(`${COOKIE_NAME}=`));if(!item)return null;try{const data=JSON.parse(decodeURIComponent(item.slice(COOKIE_NAME.length+1)));if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!['fullName','uik'].includes(key)))return null;const profile={};for(const key of ['fullName','uik'])if(typeof data[key]==='string'&&data[key].trim()&&data[key].length<=MAX_LENGTH[key])profile[key]=data[key].trim();return Object.keys(profile).length?profile:null}catch(error){return null}};
  const setCookie=profile=>{document.cookie=`${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(profile))}; ${attrs}`};
  const removeCookie=()=>{document.cookie=`${COOKIE_NAME}=; Max-Age=0; ${attrs}`};
  const apply=()=>{const profile=getCookie();if(!profile)return;document.querySelectorAll('[data-profile-field]').forEach(field=>{const key=field.dataset.profileField;if(profile[key]&&!(field.value||'').trim())field.value=profile[key]})};
  const today=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`};
  const initCatalog=()=>{const form=document.querySelector('[data-profile-form]');if(!form)return;const status=form.querySelector('[role="status"]');const message=text=>{status.textContent=text};const fields={fullName:form.querySelector('[data-profile-field="fullName"]'),uik:form.querySelector('[data-profile-field="uik"]')};const profile=getCookie();if(profile)Object.entries(fields).forEach(([key,field])=>{if(field)field.value=profile[key]||''});form.querySelector('[data-profile-save]').addEventListener('click',()=>{const next={};for(const key of Object.keys(fields)){const value=fields[key].value.trim();if(value&&value.length<=MAX_LENGTH[key])next[key]=value}if(!next.fullName&&!next.uik){message('Введите ФИО или УИК.');return}setCookie(next);message('Данные сохранены в этом браузере на 30 дней.')});form.querySelector('[data-profile-remove]').addEventListener('click',()=>{removeCookie();Object.values(fields).forEach(field=>{if(field)field.value=''});message('Сохранённые данные удалены.')})};
  window.VoteProfile={apply,get:getCookie,save:setCookie,remove:removeCookie};
  apply();
  const date=document.querySelector('input#date');if(date&&!date.value)date.value=today();
  initCatalog();
})();
