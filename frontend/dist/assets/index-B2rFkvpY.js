(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const r of a)if(r.type==="childList")for(const s of r.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function n(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?r.credentials="include":a.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(a){if(a.ep)return;a.ep=!0;const r=n(a);fetch(a.href,r)}})();const it="/api/behavior-metrics/";function At(t){var o,c,d;if(!t||t.nodeType!==Node.ELEMENT_NODE)return null;const e=t.tagName.toLowerCase();if(!(e==="button"||e==="input"||t.getAttribute("role")==="button"))return null;if(e==="input"){const u=(t.getAttribute("type")||"text").toLowerCase();if(u!=="submit"&&u!=="button"&&u!=="reset")return null}const i=(o=t.id)==null?void 0:o.trim();if(i)return`id:${i}`;const a=(c=t.getAttribute("name"))==null?void 0:c.trim();if(a)return`name:${a}`;const r=(d=t.getAttribute("aria-label"))==null?void 0:d.trim();if(r)return`aria:${r.slice(0,120)}`;const s=(t.textContent||"").replace(/\s+/g," ").trim().slice(0,80);return s?`text:${s}`:`${e}`}function Et(t){return t instanceof Element?t.closest('button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"]'):null}function T(t){const e=Et(t.target),n=At(e);if(!n)return;const i=T._counts||(T._counts={});i[n]=(i[n]||0)+1}function qt(){return T._counts?{...T._counts}:{}}function Lt(){const t=Date.now(),e=performance.now(),n=[];let i={x:0,y:0};function a(l){i={x:Math.round(l.pageX),y:Math.round(l.pageY)}}document.addEventListener("click",T,!0),document.addEventListener("pointermove",a,{passive:!0});function r(){const l=(performance.now()-e)/1e3,p=JSON.stringify(qt()),A=JSON.stringify(n);return{application_id:0,time_on_page:l,buttons_clicked:p,cursor_positions:A,return_frequency:0}}async function s(){const l=r();try{const p=await fetch(it,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(l),credentials:"same-origin",keepalive:!0});if(!p.ok){const A=await p.text().catch(()=>"");console.warn("[behavior-metrics] POST failed:",p.status,A.slice(0,500))}}catch(p){console.warn("[behavior-metrics] POST error:",p)}}const o=()=>{const l=(Date.now()-t)/1e3;n.push({t:l,x:i.x,y:i.y}),s()},c=window.setInterval(o,1e3);function d(){window.clearInterval(c),document.removeEventListener("click",T,!0),document.removeEventListener("pointermove",a),T._counts={}}function u(){try{const l=r();navigator.sendBeacon(it,new Blob([JSON.stringify(l)],{type:"application/json"}))}catch{}}return window.addEventListener("pagehide",u,{once:!0}),d}const rt=12e4,S=140,$=80,F="/",dt=F.endsWith("/")?F:`${F}/`,$t=`${dt}form-heatmap-bg.png`,kt=`${dt}form-heatmap-bg.svg`,Tt=`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2418"/><stop offset="1" stop-color="#15120c"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><rect x="48" y="72" width="864" height="396" rx="14" fill="none" stroke="rgba(248,215,143,0.45)" stroke-width="2"/><text x="480" y="44" fill="#f8cc6f" font-size="16" text-anchor="middle" font-family="system-ui,sans-serif">Подложка (офлайн)</text></svg>')}`;function Mt(t){const e=String(t||"").trim();if(!e)return[];try{const n=JSON.parse(e);if(!Array.isArray(n))return[];const i=[];for(const a of n){if(!a||typeof a!="object")continue;const r=Number(a.x),s=Number(a.y);!Number.isFinite(r)||!Number.isFinite(s)||i.push({x:r,y:s})}return i}catch{return[]}}function Nt(t){const e=[];for(const n of t||[])e.push(...Mt(n.cursor_positions));if(e.length>rt){const n=Math.ceil(e.length/rt),i=[];for(let a=0;a<e.length;a+=n)i.push(e[a]);return i}return e}function mt(t){let e=1/0,n=-1/0,i=1/0,a=-1/0;for(const{x:r,y:s}of t)e=Math.min(e,r),n=Math.max(n,r),i=Math.min(i,s),a=Math.max(a,s);return Number.isFinite(e)?{minX:e,maxX:n,minY:i,maxY:a}:{minX:0,maxX:1,minY:0,maxY:1}}function Ot(t){const e=205-t*205,n=.12+t*.58;return`hsla(${e}, 100%, 62%, ${n})`}function Dt(t,e,n){const i=new Float32Array(e*n);for(let a=0;a<n;a++)for(let r=0;r<e;r++){let s=0,o=0;for(let c=-1;c<=1;c++)for(let d=-1;d<=1;d++){const u=r+d,l=a+c;u<0||l<0||u>=e||l>=n||(s+=t[l*e+u],o+=1)}i[a*e+r]=s/o}return i}function U(t){return new Promise(e=>{const n=new Image;n.decoding="async",n.onload=()=>e(n),n.onerror=()=>e(null),n.src=t})}async function It(){let t=await U($t);return t||(t=await U(kt)),t||(t=await U(Tt)),t}function Ht(t){try{const e=t.contentDocument;if(!e)return null;const n=e.documentElement,i=e.body,a=Math.max((n==null?void 0:n.scrollWidth)||0,(i==null?void 0:i.scrollWidth)||0,(n==null?void 0:n.offsetWidth)||0,(i==null?void 0:i.offsetWidth)||0,(n==null?void 0:n.clientWidth)||0),r=Math.max((n==null?void 0:n.scrollHeight)||0,(i==null?void 0:i.scrollHeight)||0,(n==null?void 0:n.offsetHeight)||0,(i==null?void 0:i.offsetHeight)||0,(n==null?void 0:n.clientHeight)||0);return a<2||r<2?null:{w:a,h:r}}catch{return null}}async function Pt(t,e=90){for(let n=0;n<e;n++){const i=Ht(t);if(i)return i;await new Promise(a=>setTimeout(a,100))}return null}const B=960;function jt(t,e){t.style.width="",t.style.height="",e.width=B,e.height=540}function Ct(t,e,n,i){const a=Math.max(n,1),r=Math.max(i,1),s=960,o=typeof window<"u"?window.innerHeight:900,c=Math.min(Math.round(o*.88),2400),d=a/r;let u=s,l=Math.round(u/d);l>c&&(l=c,u=Math.round(l*d)),u=Math.max(280,u),l=Math.max(240,l),t.style.width=`${u}px`,t.style.height=`${l}px`;const p=Math.min(4e3,Math.max(320,Math.round(B*r/a)));e.width=B,e.height=p}function Ft(t,e,n,i){const a=i.getBoundingClientRect(),r=Math.max(1,a.width),s=Math.max(1,a.height);t.style.display="block",t.style.width=`${e}px`,t.style.height=`${n}px`;const o=Math.min(r/e,s/n),c=(r-e*o)/2,d=(s-n*o)/2;return t.style.transform=`translate(${c}px, ${d}px) scale(${o})`,t.style.transformOrigin="0 0",{viewW:r,viewH:s,docW:e,docH:n,scale:o,ox:c,oy:d}}function Ut(t,e){const{minX:n,maxX:i,minY:a,maxY:r}=mt(t),s=i-n||1,o=r-a||1;return e?{refW:Math.max(e.w,i*1.02,960),refH:Math.max(e.h,r*1.02,800)}:{refW:Math.max(s*1.08,960),refH:Math.max(o*1.08,800)}}function Rt(t,e,n,i){const a=Math.max(n,1),r=Math.max(i,1);for(const{x:s,y:o}of e){const c=Math.min(1,Math.max(0,s/a)),d=Math.min(1,Math.max(0,o/r)),u=Math.min(S-1,Math.max(0,Math.floor(c*S))),l=Math.min($-1,Math.max(0,Math.floor(d*$)));t[l*S+u]+=1}}function Bt(t,e){const{minX:n,maxX:i,minY:a,maxY:r}=mt(e),s=Math.max(i-n,1e-6),o=Math.max(r-a,1e-6),c=.03,d=1-2*c,u=1-2*c;for(const{x:l,y:p}of e){const A=c+d*((l-n)/s),I=c+u*((p-a)/o),M=Math.min(S-1,Math.max(0,Math.floor(A*S))),H=Math.min($-1,Math.max(0,Math.floor(I*$)));t[H*S+M]+=1}}function Jt(t,e,n){var r;const i=e/S,a=n/$;t.save(),t.globalCompositeOperation="lighter";for(let s=0;s<$;s++)for(let o=0;o<S;o++){const c=(r=t.__heatSmooth)==null?void 0:r[s*S+o];if(!c||c<=0)continue;const d=t.__heatLogMax||1,u=d>0?Math.log(1+c)/d:0;t.fillStyle=Ot(u);const l=1.15;t.fillRect(o*i-l,s*a-l,i+l*2,a+l*2)}t.restore()}async function st(t,e,n,i={}){var et;const a=i.stack||null,r=((et=a==null?void 0:a.querySelector)==null?void 0:et.call(a,".admin-heatmap-live-frame"))??null;if(!t)return;const s=t.getContext("2d");if(!s)return;const o=Nt(n);e&&(e.hidden=o.length>0,e.textContent=o.length===0?"Нет координат курсора в загруженных записях — откройте главную форму и подвигайте мышью.":"");let c=null,d=!1;if(r&&a){r.style.display="block",r.style.width="1280px",r.style.height="2400px";const nt=`${window.location.origin||""}/`;r.getAttribute("src")!==nt&&r.setAttribute("src",nt),await new Promise(N=>{var at;if(((at=r.contentDocument)==null?void 0:at.readyState)==="complete"){N();return}r.addEventListener("load",()=>N(),{once:!0}),r.addEventListener("error",()=>N(),{once:!0}),setTimeout(N,12e3)}),await new Promise(N=>requestAnimationFrame(()=>requestAnimationFrame(N))),c=await Pt(r),c?d=!0:r.style.display="none"}else r&&(r.style.display="none");d&&c&&a&&r?(Ct(a,t,c.w,c.h),await new Promise(E=>requestAnimationFrame(()=>requestAnimationFrame(E))),Ft(r,c.w,c.h,a)):a&&jt(a,t);const u=t.width,l=t.height,{refW:p,refH:A}=Ut(o,c),I=new Float32Array(S*$);d&&c?Rt(I,o,p,A):Bt(I,o);const M=Dt(I,S,$);let H=0;for(let E=0;E<M.length;E++)M[E]>H&&(H=M[E]);const xt=Math.log(1+H);if(s.__heatSmooth=M,s.__heatLogMax=xt,s.globalCompositeOperation="source-over",s.clearRect(0,0,u,l),!d){const E=await It();E?s.drawImage(E,0,0,u,l):(s.fillStyle="#0f0d09",s.fillRect(0,0,u,l))}if(o.length===0){s.font="14px Inter, system-ui, sans-serif",s.fillStyle="rgba(255, 240, 210, 0.8)",s.fillText(d?"Нет точек — показана живая главная страница.":"Нет точек для heatmap.",16,36),delete s.__heatSmooth,delete s.__heatLogMax;return}Jt(s,u,l),s.font="12px Inter, system-ui, sans-serif",s.fillStyle="rgba(255, 248, 220, 0.92)",s.strokeStyle="rgba(0,0,0,0.5)",s.lineWidth=3;const St=d?"живая страница":"статичный фон",_t=d&&c?"по документу":"по min–max точек",tt=`точек: ${o.length} · ${St} · ${_t} · ref ${Math.round(p)}×${Math.round(A)} px`;s.strokeText(tt,10,l-10),s.fillText(tt,10,l-10),delete s.__heatSmooth,delete s.__heatLogMax}const C=[{name:"first_name",label:"Имя",required:!0,type:"text",maxLength:200},{name:"last_name",label:"Фамилия",required:!0,type:"text",maxLength:200},{name:"patronymic",label:"Отчество",type:"text",maxLength:200},{name:"email",label:"Email",type:"email"},{name:"phone",label:"Телефон",type:"tel",maxLength:64},{name:"business_info",label:"Кратко о бизнесе",required:!0,type:"textarea",maxLength:16e3,rows:4},{name:"business_niche",label:"Ниша бизнеса",type:"text",maxLength:2e3},{name:"company_size",label:"Размер компании",type:"text",maxLength:500},{name:"task_volume",label:"Объем задачи",type:"text",maxLength:500},{name:"role_in_company",label:"Ваша роль в компании",type:"text",maxLength:200},{name:"business_size",label:"Масштаб бизнеса",type:"text",maxLength:500},{name:"need_volume",label:"Потребность/нагрузка",type:"text",maxLength:500},{name:"result_deadline",label:"Желаемый срок результата",type:"text",maxLength:500},{name:"task_type",label:"Тип задачи",type:"text",maxLength:500},{name:"product_of_interest",label:"Интересующий продукт",type:"text",maxLength:500},{name:"budget",label:"Бюджет",required:!0,type:"text",maxLength:200},{name:"preferred_contact_method",label:"Предпочитаемый способ связи",type:"text",maxLength:200},{name:"convenient_contact_time",label:"Удобное время для связи",type:"text",maxLength:200},{name:"comments",label:"Дополнительные комментарии",type:"textarea",rows:3,maxLength:16e3}],Wt=document.querySelector("#app-root");let R=null;const J="admin_jwt_token";let b=[],h=-1,k=null,G={},L=[],j=null,q=40,y=0;function ut(){return window.localStorage.getItem(J)||""}function w(t){if(!t){window.localStorage.removeItem(J);return}window.localStorage.setItem(J,t)}async function g(t,e={},{requiresAuth:n=!1}={}){const i={...e.headers||{}};if(n){const r=ut();if(!r)throw new Error("Нет токена авторизации");i.Authorization=`Bearer ${r}`}return await fetch(t,{...e,headers:i,credentials:"same-origin"})}function X(t,{title:e,subtitle:n,eyebrow:i,showAdminLink:a}){document.title=e,Wt.innerHTML=`
    <main class="page">
      <section class="hero">
        <div class="top-nav">
          <a class="nav-link" href="/">Форма заявки</a>
          ${a?'<a class="nav-link" href="/admin">Админка</a>':""}
        </div>
        <p class="eyebrow">${i}</p>
        <h1>${e}</h1>
        <p class="subtitle">${n}</p>
      </section>
      <section class="card">${t}</section>
    </main>
  `}function Zt(){return document.querySelector("#status")}function m(t,e){const n=Zt();n&&(n.textContent=t,n.dataset.type=e)}function zt(){const t=document.querySelector("#application-form");if(!t)return;const e=C.map(n=>{const i=[`name="${n.name}"`,`id="${n.name}"`,n.required?"required":"",n.maxLength?`maxlength="${n.maxLength}"`:"",n.type&&n.type!=="textarea"?`type="${n.type}"`:"",'autocomplete="off"'].filter(Boolean).join(" "),a=n.type==="textarea"?`<textarea ${i} rows="${n.rows??4}"></textarea>`:`<input ${i} />`;return`
      <label class="field" for="${n.name}">
        <span>${n.label}${n.required?" *":""}</span>
        ${a}
      </label>
    `}).join("");t.innerHTML=`
    <div class="form-grid">${e}</div>
    <button class="submit-btn" type="submit">Отправить заявку</button>
  `}function Gt(){const t=document.querySelector("#application-form");if(!t)return{};const e={},n=new FormData(t);for(const i of C){const a=(n.get(i.name)||"").toString().trim();e[i.name]=a.length===0?null:a}return e.first_name=e.first_name||"",e.last_name=e.last_name||"",e.business_info=e.business_info||"",e.budget=e.budget||"",e}function ft(t){t.classList.remove("success-burst"),t.offsetWidth,t.classList.add("success-burst"),R&&window.clearTimeout(R),R=window.setTimeout(()=>{t.classList.remove("success-burst")},1100)}async function Xt(t){t.preventDefault(),m("","");const e=document.querySelector("#application-form");if(!e)return;const n=e.querySelector('button[type="submit"]');if(!n)return;n.disabled=!0;const i=Gt();if(!i.first_name||!i.last_name||!i.business_info||!i.budget){m("Заполните обязательные поля: имя, фамилия, информация о бизнесе и бюджет.","error"),n.disabled=!1;return}try{const a=await fetch("/api/v1/applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(i)});if(!a.ok){const s=await a.text();throw new Error(s||"Не удалось отправить заявку")}const r=await a.json();e.reset(),m(`Заявка отправлена. ID: ${r.id}`,"success"),ft(n)}catch(a){console.error(a),m("Ошибка отправки. Попробуйте еще раз через минуту.","error")}finally{n.disabled=!1}}function Yt(){X(`
      <form id="application-form" class="form" novalidate></form>
      <p id="status" class="status" role="status" aria-live="polite"></p>
    `,{title:"Заявка на персональный разбор бизнеса",subtitle:"Заполните форму, и мы подготовим персональный разбор задачи с рекомендациями по масштабированию.",eyebrow:"Private Strategy Form",showAdminLink:!0});const t=document.querySelector("#application-form");zt(),t.addEventListener("submit",Xt);const e=Lt();window.addEventListener("pagehide",()=>{e()},{once:!0})}function Vt(t){return JSON.stringify(t??{},null,2)}function pt(t){if(!t||typeof t!="object"||Array.isArray(t))return"";const e=Object.keys(t);return e.length===0?"":e.length===1&&typeof t.range=="string"?t.range:Vt(t)}function Kt(t){const e=(t||"").trim();if(!e)return{};try{const n=JSON.parse(e);if(n&&typeof n=="object"&&!Array.isArray(n))return n}catch{}return{range:e}}function ht(t){const e=t&&typeof t=="object"&&!Array.isArray(t)?{...t}:{},n=typeof e.formNotes=="string"?e.formNotes:"";return delete e.formNotes,G=e,n}function Qt(t){const e=(t||"").trim(),n={...G};return e?n.formNotes=e:delete n.formNotes,n}function Y(t){return Array.isArray(t)?t.map(e=>typeof e=="string"?{title:e}:e&&typeof e=="object"&&!Array.isArray(e)?{...e}:{title:String(e??"")}):[]}function te(t){return!t||typeof t!="object"?!0:!Object.keys(t).some(e=>{const n=t[e];return n==null?!1:typeof n=="string"?n.trim()!=="":typeof n=="number"||typeof n=="boolean"?!0:Array.isArray(n)?n.length>0:typeof n=="object"?Object.keys(n).length>0:!0})}function V(){return b.map(t=>JSON.parse(JSON.stringify(t))).filter(t=>!te(t))}function yt(){return b.length>0&&V().length===0}function f(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function bt(){var n,i;const t=document.querySelector("#admin-config-form");if(!(!t||!((i=(n=t.querySelector("#config-id"))==null?void 0:n.value)!=null&&i.trim()))){if(yt()){k&&(window.clearTimeout(k),k=null);return}k&&window.clearTimeout(k),k=window.setTimeout(()=>{k=null,ee()},700)}}async function ee(){var n,i;const t=document.querySelector("#admin-config-form");if(!t)return;const e=(i=(n=t.querySelector("#config-id"))==null?void 0:n.value)==null?void 0:i.trim();if(!e){m("Сначала сохраните конфигурацию целиком, чтобы получить ID — затем список услуг можно синхронизировать с сервером.","error");return}if(!yt()){m("Сохранение услуг…","");try{const a=await g(`/api/v1/admin-config/${e}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({services_offered:V()})},{requiresAuth:!0});if(a.status===401)throw w(""),new Error("UNAUTHORIZED");if(!a.ok){const s=await a.text();throw new Error(s||"Не удалось сохранить список услуг")}const r=await a.json();b=Y(r.services_offered),h>=b.length&&(h=b.length-1),O(),m("Список услуг обновлён на сервере.","success")}catch(a){if(console.error(a),(a==null?void 0:a.message)==="UNAUTHORIZED"){await _(),m("Сессия истекла. Войдите снова.","error");return}m((a==null?void 0:a.message)||"Ошибка сохранения услуг","error")}}}function ne(){const t=document.querySelector("#admin-services-editor");t&&(t.addEventListener("click",e=>{const n=e.target.closest("tr[data-service-index]");if(!n)return;const i=Number(n.getAttribute("data-service-index"));Number.isFinite(i)&&(h=i,t.querySelectorAll("tr[data-service-index]").forEach(a=>{a.classList.toggle("is-selected",Number(a.getAttribute("data-service-index"))===h)}))}),t.addEventListener("input",e=>{const n=e.target,i=Number(n.getAttribute("data-service-idx")),a=n.getAttribute("data-service-field");if(!Number.isFinite(i)||!a)return;const r=b[i];!r||typeof r!="object"||(r[a]=n.value,bt())}))}function O(){const t=document.querySelector("#admin-services-editor [data-services-tbody]");if(!t)return;const e=b.map((n,i)=>{const a=f(n.title!=null?String(n.title):""),r=i===h?" is-selected":"",s=i+1;return`
        <tr data-service-index="${i}" class="${r.trim()}">
          <td class="admin-svc-id-cell">${s}</td>
          <td>
            <input
              type="text"
              class="admin-svc-title-input"
              data-service-idx="${i}"
              data-service-field="title"
              value="${a}"
              placeholder="Название услуги"
              autocomplete="off"
            />
          </td>
        </tr>
      `}).join("");t.innerHTML=e||'<tr class="admin-services-empty"><td colspan="2">Услуг пока нет — нажмите «+ Добавить» справа.</td></tr>',t.querySelectorAll("tr[data-service-index]").forEach(n=>{const i=Number(n.getAttribute("data-service-index"));n.classList.toggle("is-selected",i===h)})}function ot(){var n;const t=document.querySelector("#admin-services-editor");if(!t||h<0)return;const e=t.querySelector(`.admin-svc-title-input[data-service-idx="${h}"][data-service-field="title"]`);e&&(e.focus(),(n=e.select)==null||n.call(e))}function ae(){var e,n,i;const t=document.querySelector("#admin-services-toolbar");t&&((e=t.querySelector("[data-action=service-add]"))==null||e.addEventListener("click",()=>{b.push({title:""}),h=b.length-1,O(),ot()}),(n=t.querySelector("[data-action=service-edit]"))==null||n.addEventListener("click",()=>{if(h<0||h>=b.length){m("Выберите строку в таблице (клик по строке), затем нажмите «Редактировать».","error");return}ot()}),(i=t.querySelector("[data-action=service-delete-selected]"))==null||i.addEventListener("click",()=>{if(h<0||h>=b.length){m("Выберите строку в таблице, затем «Удалить».","error");return}b.splice(h,1),h=Math.min(h,b.length-1),O(),bt()}))}function v(t,e){const n=document.querySelector("#admin-leads-status");n&&(n.textContent=t||"",e?n.dataset.type=e:delete n.dataset.type)}function W(t){try{return new Date(t).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"})}catch{return t||"—"}}function ie(t){try{return new Date(t).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return t||"—"}}function Z(t,e){if(t==null||String(t).trim()==="")return"—";const n=String(t).replace(/\s+/g," ").trim();return n.length<=e?n:`${n.slice(0,e)}…`}async function re(){const t=await g("/api/v1/applications?limit=100&offset=0",{},{requiresAuth:!0});if(t.status===401)throw w(""),new Error("UNAUTHORIZED");if(!t.ok)throw new Error("Не удалось загрузить заявки");const e=await t.json();return Array.isArray(e)?e:[]}function x(t,e){const n=document.querySelector("#admin-telemetry-status");n&&(n.textContent=t||"",e?n.dataset.type=e:delete n.dataset.type)}async function ct(){const t=new URLSearchParams({limit:String(q),offset:String(y)}),e=await g(`/api/v1/page-behavior-telemetry?${t}`,{},{requiresAuth:!0});if(e.status===401)throw w(""),new Error("UNAUTHORIZED");if(!e.ok){const n=await e.text();let i=n;try{const a=JSON.parse(n);a!=null&&a.detail&&(i=typeof a.detail=="string"?a.detail:JSON.stringify(a.detail))}catch{}throw new Error(i||"Не удалось загрузить статистику")}return e.json()}function lt(t,e){const n=document.querySelector("#admin-telemetry-page-info"),i=document.querySelector("#admin-telemetry-prev"),a=document.querySelector("#admin-telemetry-next"),r=document.querySelector("#admin-telemetry-page-size");r&&String(r.value)!==String(q)&&(r.value=String(q));const s=Math.max(0,Number(t)||0),o=s===0?0:y+1,c=y+e;n&&(n.textContent=s===0?"В базе 0 записей":`Записи ${o}–${c} из ${s} · страница ${Math.floor(y/q)+1}`),i&&(i.disabled=y<=0),a&&(a.disabled=s===0||y+e>=s)}async function se(t){const e=document.querySelector("#admin-telemetry-tbody");if(!e)return;const n=Array.isArray(t==null?void 0:t.items)?t.items:[],i=Number(t==null?void 0:t.total)||0;if(n.length===0){e.innerHTML='<tr><td colspan="5" class="admin-leads-empty">На этой странице пусто. Перейдите назад или откройте главную форму для новых снимков.</td></tr>',x(i?`Всего в базе: ${i}. Смещение ${y} — записей нет.`:"Всего записей в базе: 0",i?"success":""),lt(i,0),await st(document.querySelector("#admin-cursor-heatmap"),document.querySelector("#admin-heatmap-placeholder"),[],{stack:document.querySelector("#admin-heatmap-stack")});return}e.innerHTML=n.map(a=>{const r=f(String(a.id)),s=f(ie(a.received_at)),o=f(Number(a.time_on_page_seconds).toFixed(1)),c=String(a.buttons_clicked||""),d=String(a.cursor_positions||""),u=f(Z(c,22)),l=f(Z(d,32)),p=f(c.slice(0,2e3)),A=f(d.slice(0,4e3));return`
        <tr class="admin-telemetry-row">
          <td class="admin-telemetry-col-id">${r}</td>
          <td class="admin-telemetry-col-time">${s}</td>
          <td class="admin-telemetry-col-sec">${o}</td>
          <td class="admin-stats-cell-mono admin-telemetry-col-json" title="${p}">${u}</td>
          <td class="admin-stats-cell-mono admin-telemetry-col-json" title="${A}">${l}</td>
        </tr>
      `}).join(""),x("Данные загружены.","success"),lt(i,n.length),await st(document.querySelector("#admin-cursor-heatmap"),document.querySelector("#admin-heatmap-placeholder"),n,{stack:document.querySelector("#admin-heatmap-stack")})}async function P(){let t=await ct();const e=Number(t==null?void 0:t.total)||0;(Array.isArray(t==null?void 0:t.items)?t.items:[]).length===0&&e>0&&y>=e&&(y=Math.max(0,(Math.ceil(e/q)-1)*q),t=await ct()),await se(t)}function oe(){var t,e,n,i;(t=document.querySelector("#admin-telemetry-refresh-btn"))==null||t.addEventListener("click",async()=>{x("Загрузка…","");try{y=0,await P()}catch(a){if(console.error(a),(a==null?void 0:a.message)==="UNAUTHORIZED"){await _(),m("Сессия истекла. Войдите снова.","error");return}x((a==null?void 0:a.message)||"Ошибка загрузки. Проверьте, что в базе есть таблица page_behavior_telemetry.","error")}}),(e=document.querySelector("#admin-telemetry-page-size"))==null||e.addEventListener("change",async a=>{const r=parseInt(a.target.value,10);if(!(!Number.isFinite(r)||r<1)){q=Math.min(200,r),y=0,x("Загрузка…","");try{await P()}catch(s){console.error(s),x((s==null?void 0:s.message)||"Ошибка загрузки","error")}}}),(n=document.querySelector("#admin-telemetry-prev"))==null||n.addEventListener("click",async()=>{if(!(y<=0)){y=Math.max(0,y-q),x("Загрузка…","");try{await P()}catch(a){console.error(a),x((a==null?void 0:a.message)||"Ошибка загрузки","error")}}}),(i=document.querySelector("#admin-telemetry-next"))==null||i.addEventListener("click",async()=>{y+=q,x("Загрузка…","");try{await P()}catch(a){console.error(a),y=Math.max(0,y-q),x((a==null?void 0:a.message)||"Ошибка загрузки","error")}})}async function ce(t){const e=await g(`/api/v1/applications/${t}`,{},{requiresAuth:!0});if(e.status===401)throw w(""),new Error("UNAUTHORIZED");if(!e.ok){const n=await e.text();throw new Error(n||"Заявка не найдена")}return e.json()}function D(){const t=document.querySelector("#admin-leads-tbody");if(t){if(L.length===0){t.innerHTML='<tr><td colspan="7" class="admin-leads-empty">Заявок пока нет.</td></tr>';return}t.innerHTML=L.map(e=>{const n=e.id===j?" is-selected":"",i=f(e.first_name||""),a=f(e.last_name||""),r=f(e.email||"—"),s=f(e.phone||"—"),o=f(Z(e.budget,40)),c=f(W(e.created_at));return`
        <tr data-lead-id="${e.id}" class="${n.trim()}">
          <td class="admin-leads-id">${e.id}</td>
          <td>${c}</td>
          <td>${i}</td>
          <td>${a}</td>
          <td>${r}</td>
          <td>${s}</td>
          <td>${o}</td>
        </tr>
      `}).join(""),t.querySelectorAll("tr[data-lead-id]").forEach(e=>{e.addEventListener("click",()=>{const n=Number(e.getAttribute("data-lead-id"));Number.isFinite(n)&&de(n)})})}}function gt(t){const e=C.map(a=>{const r=t[a.name]!=null?String(t[a.name]):"",s=f(r),o=[`id="lead-edit-${a.name}"`,`name="${a.name}"`,a.maxLength?`maxlength="${a.maxLength}"`:"",a.type&&a.type!=="textarea"?`type="${a.type}"`:"",'autocomplete="off"'].filter(Boolean).join(" "),c=a.type==="textarea"?`<textarea ${o} rows="${a.rows??4}">${s}</textarea>`:`<input ${o} value="${s}" />`,d=a.required?" *":"";return`
      <label class="field" for="lead-edit-${a.name}">
        <span>${a.label}${d}</span>
        ${c}
      </label>
    `}).join(""),n=f(W(t.created_at)),i=f(W(t.updated_at));return`
    <div class="admin-lead-detail-inner">
      <div class="admin-lead-meta">
        <span>Заявка № <strong>${t.id}</strong></span>
        <span>Создана: ${n}</span>
        <span>Обновлена: ${i}</span>
      </div>
      <form id="admin-lead-edit-form" class="form" novalidate>
        <div class="form-grid">${e}</div>
        <div class="admin-lead-actions">
          <button class="submit-btn admin-btn admin-btn--primary" type="submit">Сохранить изменения</button>
          <button type="button" class="admin-btn admin-btn--danger-sm" id="admin-lead-delete-btn">Удалить заявку</button>
          <button type="button" class="admin-btn admin-btn--ghost" id="admin-lead-close-btn">Закрыть</button>
        </div>
      </form>
    </div>
  `}function le(t){const e={};for(const n of C){const i=t.querySelector(`#lead-edit-${n.name}`);let a=i?i.value:"";n.type==="textarea"?a=a.replace(/\r\n/g,`
`).trimEnd():a=a.trim(),n.name==="email"?e.email=a===""?null:a:!n.required&&a===""?e[n.name]="":e[n.name]=a}return e}function z(){j=null;const t=document.querySelector("#admin-lead-detail");t&&(t.innerHTML="",t.setAttribute("hidden","hidden")),D()}async function de(t){j=t,D();const e=document.querySelector("#admin-lead-detail");if(e){e.removeAttribute("hidden"),e.innerHTML='<p class="status">Загрузка заявки…</p>';try{const n=await ce(t);e.innerHTML=gt(n),vt()}catch(n){if(console.error(n),(n==null?void 0:n.message)==="UNAUTHORIZED"){await _(),m("Сессия истекла. Войдите снова.","error");return}e.innerHTML=`<p class="status" data-type="error">${f((n==null?void 0:n.message)||"Ошибка загрузки")}</p>`,v((n==null?void 0:n.message)||"Не удалось открыть заявку","error")}}}function vt(){const t=document.querySelector("#admin-lead-edit-form"),e=document.querySelector("#admin-lead-delete-btn"),n=document.querySelector("#admin-lead-close-btn");t&&(t.addEventListener("submit",async i=>{i.preventDefault(),v("","");const a=j;if(!a)return;const r=le(t);if(!r.first_name||!r.last_name||!r.business_info||!r.budget){v("Имя, фамилия, блок о бизнесе и бюджет обязательны.","error");return}const s=t.querySelector('button[type="submit"]');s&&(s.disabled=!0);try{const o=await g(`/api/v1/applications/${a}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)},{requiresAuth:!0});if(o.status===401)throw w(""),new Error("UNAUTHORIZED");if(!o.ok){const l=await o.text();throw new Error(l||"Сохранение не удалось")}const c=await o.json(),d=L.findIndex(l=>l.id===a);d>=0&&(L[d]=c);const u=document.querySelector("#admin-lead-detail");u&&(u.innerHTML=gt(c),vt()),D(),v("Заявка сохранена.","success"),m("Заявка обновлена.","success")}catch(o){if(console.error(o),(o==null?void 0:o.message)==="UNAUTHORIZED"){await _(),m("Сессия истекла. Войдите снова.","error");return}v((o==null?void 0:o.message)||"Ошибка сохранения","error")}finally{const o=document.querySelector('#admin-lead-edit-form button[type="submit"]');o&&(o.disabled=!1)}}),e==null||e.addEventListener("click",async()=>{const i=j;if(i&&window.confirm(`Удалить заявку № ${i}? Действие необратимо.`)){v("","");try{const a=await g(`/api/v1/applications/${i}`,{method:"DELETE"},{requiresAuth:!0});if(a.status===401)throw w(""),new Error("UNAUTHORIZED");if(!a.ok){const r=await a.text();throw new Error(r||"Удаление не удалось")}L=L.filter(r=>r.id!==i),z(),D(),v("Заявка удалена.","success"),m("Заявка удалена.","success")}catch(a){if(console.error(a),(a==null?void 0:a.message)==="UNAUTHORIZED"){await _(),m("Сессия истекла. Войдите снова.","error");return}v((a==null?void 0:a.message)||"Ошибка удаления","error")}}}),n==null||n.addEventListener("click",()=>{z(),v("","")}))}async function wt(){v("Загрузка заявок…","");try{L=await re(),D(),v(`Загружено заявок: ${L.length}`,"success")}catch(t){if(console.error(t),(t==null?void 0:t.message)==="UNAUTHORIZED")throw t;L=[],D(),v((t==null?void 0:t.message)||"Ошибка загрузки заявок","error")}}function me(){var t;(t=document.querySelector("#admin-leads-refresh-btn"))==null||t.addEventListener("click",()=>{wt()})}async function ue(){const t=await g("/api/v1/admin-config?limit=1&offset=0&sort=desc",{},{requiresAuth:!0});if(t.status===401)throw w(""),new Error("UNAUTHORIZED");if(!t.ok)throw new Error("Не удалось загрузить настройки сайта");const e=await t.json();return!Array.isArray(e)||e.length===0?null:e[0]}async function fe(){const t=await g("/api/v1/admins?limit=200&offset=0",{},{requiresAuth:!0});if(!t.ok)throw new Error("Не удалось загрузить список админов");const e=await t.json();return Array.isArray(e)?e:[]}async function K(){const t=document.querySelector("#admins-list");if(t)try{const e=await fe();if(e.length===0){t.innerHTML='<p class="admin-list-empty">Администраторы пока не заведены.</p>';return}t.innerHTML=e.map(n=>`
        <div class="admin-user-row">
          <span class="admin-user-row__meta">id ${n.id} · <span class="admin-user-row__login">${f(n.login)}</span></span>
          <button type="button" class="admin-btn admin-btn--danger-sm" data-admin-delete="${n.id}">Удалить</button>
        </div>
      `).join(""),t.querySelectorAll("[data-admin-delete]").forEach(n=>{n.addEventListener("click",async()=>{const i=n.getAttribute("data-admin-delete");n.disabled=!0;try{if(!(await g(`/api/v1/admins/${i}`,{method:"DELETE"},{requiresAuth:!0})).ok)throw new Error("Удаление админа не удалось");await K(),m("Админ удален","success")}catch(a){m((a==null?void 0:a.message)||"Ошибка удаления админа","error"),n.disabled=!1}})})}catch{t.innerHTML='<p class="admin-list-empty" data-type="error">Ошибка загрузки списка администраторов.</p>'}}async function pe(t){t.preventDefault(),m("","");const e=document.querySelector("#admin-config-form");if(!e)return;const n=e.querySelector('button[type="submit"]');if(n){n.disabled=!0;try{const i=e.querySelector("#config-id").value.trim(),a=e.querySelector("#budget_slider_config").value,r=e.querySelector("#ui_options").value,s={services_offered:V(),budget_slider_config:Kt(a),ui_options:Qt(r)};if(!Array.isArray(s.services_offered))throw new Error("Внутренняя ошибка: список услуг должен быть массивом.");if(typeof s.budget_slider_config!="object"||s.budget_slider_config===null||Array.isArray(s.budget_slider_config))throw new Error("«Диапазон бюджета»: если это JSON, должен быть объект { }; иначе введите обычный текст (например 900к–1,5кк).");if(typeof s.ui_options!="object"||s.ui_options===null||Array.isArray(s.ui_options))throw new Error("Внутренняя ошибка: настройки интерфейса должны быть объектом.");const o=i.length>0,c=o?`/api/v1/admin-config/${i}`:"/api/v1/admin-config",u=await g(c,{method:o?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)},{requiresAuth:!0});if(!u.ok){const p=await u.text();throw new Error(p||"Сохранение не удалось")}const l=await u.json();e.querySelector("#config-id").value=l.id,b=Y(l.services_offered),O(),e.querySelector("#budget_slider_config").value=pt(l.budget_slider_config),e.querySelector("#ui_options").value=ht(l.ui_options),m(`Конфигурация сохранена. ID: ${l.id}`,"success"),ft(n)}catch(i){console.error(i),m((i==null?void 0:i.message)||"Ошибка сохранения настроек сайта","error")}finally{n.disabled=!1}}}async function he(t){t.preventDefault();const e=document.querySelector("#admin-create-form");if(!e)return;const n=e.querySelector("#new-admin-login").value.trim().toLowerCase(),i=e.querySelector("#new-admin-password").value;if(!n||!i){m("Введите логин и пароль нового администратора","error");return}try{const a=await g("/api/v1/admins",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({login:n,password:i})},{requiresAuth:!0});if(!a.ok){const r=await a.text();throw new Error(r||"Создать администратора не удалось")}e.reset(),await K(),m("Новый администратор создан","success")}catch(a){m((a==null?void 0:a.message)||"Ошибка создания администратора","error")}}function ye(){w(""),window.location.href="/admin"}async function Q(){var e,n;X(`
      <header class="admin-page-header">
        <nav class="admin-toc" aria-label="Разделы страницы">
          <a class="admin-toc__link" href="#admin-section-leads">Заявки</a>
          <a class="admin-toc__link" href="#admin-section-stats">Статистика</a>
          <a class="admin-toc__link" href="#admin-section-site">Сайт</a>
          <a class="admin-toc__link" href="#admin-section-team">Команда</a>
        </nav>
        <button type="button" class="admin-btn admin-btn--ghost" id="logout-btn">Выйти</button>
      </header>
      <p id="status" class="status admin-status-banner" role="status" aria-live="polite"></p>

      <article class="admin-panel" id="admin-section-leads">
        <section class="admin-block admin-block--leads" aria-labelledby="admin-leads-heading">
        <div class="admin-leads-head-row">
          <div>
            <h2 id="admin-leads-heading" class="admin-block__title">Заявки на персональный разбор бизнеса</h2>
            <p class="admin-block__subtitle">Те же поля, что на публичной форме заявки. Выберите строку таблицы, чтобы открыть карточку: правка, сохранение или удаление.</p>
          </div>
          <button type="button" class="admin-btn admin-btn--secondary" id="admin-leads-refresh-btn">Обновить список</button>
        </div>
        <p id="admin-leads-status" class="status admin-leads-status" role="status" aria-live="polite"></p>
        <div class="admin-services-table-wrap admin-leads-table-wrap">
          <table class="admin-services-table admin-leads-table" aria-label="Заявки с формы">
            <thead>
              <tr>
                <th class="admin-leads-col-id">ID</th>
                <th>Создана</th>
                <th>Имя</th>
                <th>Фамилия</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Бюджет</th>
              </tr>
            </thead>
            <tbody id="admin-leads-tbody"></tbody>
          </table>
        </div>
        <div id="admin-lead-detail" class="admin-lead-detail" hidden></div>
        </section>
      </article>

      <article class="admin-panel" id="admin-section-stats">
        <section class="admin-block admin-block--stats" aria-labelledby="admin-stats-heading">
          <div class="admin-leads-head-row">
            <div>
              <h2 id="admin-stats-heading" class="admin-block__title">Статистика посещений формы</h2>
              <p class="admin-block__subtitle">
                Снимки с главной страницы (сек на странице, клики, курсор раз в секунду). POST <code>/api/behavior-metrics/</code> →
                <code>page_behavior_telemetry</code>. Таблица с пагинацией; полный JSON в подсказке при наведении на ячейку.
              </p>
            </div>
            <button type="button" class="admin-btn admin-btn--secondary" id="admin-telemetry-refresh-btn">Обновить</button>
          </div>
          <p id="admin-telemetry-status" class="status admin-leads-status" role="status" aria-live="polite"></p>
          <div class="admin-telemetry-toolbar" id="admin-telemetry-toolbar">
            <div class="admin-telemetry-toolbar__left">
              <label class="admin-telemetry-pagesize">
                <span>Строк</span>
                <select id="admin-telemetry-page-size" aria-label="Число строк на странице">
                  <option value="25">25</option>
                  <option value="40" selected>40</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <span id="admin-telemetry-page-info" class="admin-telemetry-page-info"></span>
            </div>
            <div class="admin-telemetry-toolbar__nav">
              <button type="button" class="admin-btn admin-btn--ghost admin-telemetry-nav" id="admin-telemetry-prev">Назад</button>
              <button type="button" class="admin-btn admin-btn--ghost admin-telemetry-nav" id="admin-telemetry-next">Вперёд</button>
            </div>
          </div>
          <div class="admin-services-table-wrap admin-leads-table-wrap admin-stats-table-scroll">
            <table class="admin-services-table admin-stats-table admin-telemetry-table" aria-label="Телеметрия с формы заявки">
              <thead>
                <tr>
                  <th class="admin-telemetry-col-id">ID</th>
                  <th class="admin-telemetry-col-time">Время</th>
                  <th class="admin-telemetry-col-sec">Сек.</th>
                  <th>Кнопки</th>
                  <th>Курсор</th>
                </tr>
              </thead>
              <tbody id="admin-telemetry-tbody"></tbody>
            </table>
          </div>
        </section>
        <section class="admin-block admin-block--heatmap" aria-labelledby="admin-heatmap-heading">
          <h3 id="admin-heatmap-heading" class="admin-block__title admin-heatmap-title">Карта активности курсора (Heatmap)</h3>
          <p class="admin-block__subtitle admin-heatmap-sub">
            Подложка — живая главная страница этого же сайта в iframe (масштаб под блок). Если iframe недоступен — <code>/form-heatmap-bg.png</code> или <code>/form-heatmap-bg.svg</code>. Точки нормируются по размеру документа; heatmap по строкам <strong>текущей страницы</strong> таблицы; шкала логарифмическая.
          </p>
          <p id="admin-heatmap-placeholder" class="admin-heatmap-placeholder" hidden></p>
          <div id="admin-heatmap-stack" class="admin-heatmap-stack">
            <iframe
              class="admin-heatmap-live-frame"
              title="Подложка heatmap: главная страница"
            ></iframe>
            <canvas
              id="admin-cursor-heatmap"
              class="admin-heatmap-canvas admin-heatmap-canvas-overlay"
              width="960"
              height="540"
              role="img"
              aria-label="Тепловая карта позиций курсора на странице формы"
            ></canvas>
          </div>
          <div class="admin-heatmap-legend" aria-hidden="true">
            <span>реже</span>
            <div class="admin-heatmap-legend-bar"></div>
            <span>чаще</span>
          </div>
        </section>
      </article>

      <article class="admin-panel" id="admin-section-site">
        <h2 class="admin-panel__title">Настройки сайта</h2>
        <p class="admin-panel__lead">Каталог услуг, подпись диапазона бюджета и короткий текст на странице заявки.</p>
      <form id="admin-config-form" class="form admin-site-form" novalidate>
        <div class="admin-config-id-row">
          <label class="field admin-field-compact" for="config-id">
            <span>ID конфигурации</span>
            <input id="config-id" name="config-id" type="text" readonly class="admin-input-readonly" />
          </label>
        </div>
        <section class="admin-block admin-block--services" aria-labelledby="admin-services-heading">
          <header class="admin-block__head">
            <h2 id="admin-services-heading" class="admin-block__title">Услуги</h2>
            <p class="admin-block__subtitle">Управление списком услуг</p>
            <p class="admin-services-hint admin-services-hint--tight">Данные хранятся в <code>site_admin_config.services_offered</code>. В таблице — порядковый <strong>ID</strong> и <strong>название</strong>; остальные поля в JSON услуги (если были) сохраняются при сохранении конфигурации.</p>
          </header>
          <div id="admin-services-editor" class="admin-services-editor">
            <div class="admin-services-layout">
              <div class="admin-services-table-wrap">
                <table class="admin-services-table" aria-label="Список услуг">
                  <thead>
                    <tr>
                      <th class="admin-svc-col-id">ID</th>
                      <th>Название услуги</th>
                    </tr>
                  </thead>
                  <tbody data-services-tbody></tbody>
                </table>
              </div>
              <aside id="admin-services-toolbar" class="admin-services-toolbar" aria-label="Действия со списком услуг">
                <button type="button" class="admin-tool admin-tool--add" data-action="service-add">+ Добавить</button>
                <button type="button" class="admin-tool admin-tool--edit" data-action="service-edit">✎ Редактировать</button>
                <button type="button" class="admin-tool admin-tool--delete" data-action="service-delete-selected">✖ Удалить</button>
                <p class="admin-toolbar-footnote">При наличии ID конфигурации список синхронизируется с сервером после ввода названия (не раньше — пустая строка не отправляется, чтобы не сбрасывать список).</p>
              </aside>
            </div>
          </div>
        </section>
        <section class="admin-block admin-block--budget" aria-labelledby="admin-budget-heading">
          <h2 id="admin-budget-heading" class="admin-block__title">Диапазон бюджета</h2>
          <p id="budget-slider-hint" class="admin-block__subtitle">Одна строка с подписью для сайта (при необходимости ниже можно вставить JSON с настройками слайдера).</p>
          <textarea
            id="budget_slider_config"
            name="site_budget_label"
            rows="3"
            spellcheck="true"
            class="admin-budget-textarea"
            placeholder="например: 900 тыс. – 1,5 млн"
            aria-describedby="budget-slider-hint"
            autocomplete="off"
            data-lpignore="true"
            data-form-type="other"
          ></textarea>
        </section>
        <section class="admin-block admin-block--extra" aria-labelledby="admin-ui-heading">
          <h2 id="admin-ui-heading" class="admin-block__title">Текст на странице заявки</h2>
          <p id="ui-options-hint" class="admin-block__subtitle">Короткая подпись для посетителей (сохраняется в настройках сайта).</p>
          <input
            id="ui_options"
            name="ui_options"
            type="text"
            class="admin-form-notes-input"
            maxlength="2000"
            spellcheck="true"
            placeholder="Ответ в течение рабочего дня"
            aria-describedby="ui-options-hint"
            autocomplete="off"
          />
        </section>
        <div class="admin-form-actions">
          <button class="submit-btn admin-btn admin-btn--primary" type="submit">Сохранить настройки сайта</button>
        </div>
      </form>
      </article>

      <article class="admin-panel" id="admin-section-team">
        <h2 class="admin-panel__title">Администраторы</h2>
        <p class="admin-panel__lead">Новый логин и пароль — кнопка ниже; список существующих — с аккуратным удалением.</p>
      <form id="admin-create-form" class="form admin-team-form" novalidate>
        <div class="form-grid admin-team-grid">
        <label class="field" for="new-admin-login">
          <span>Логин нового админа</span>
          <input id="new-admin-login" type="text" minlength="3" maxlength="128" autocomplete="off" required />
        </label>
        <label class="field" for="new-admin-password">
          <span>Пароль нового админа</span>
          <input id="new-admin-password" type="password" minlength="6" maxlength="200" required />
        </label>
        </div>
        <div class="admin-form-actions admin-form-actions--tight">
          <button class="submit-btn admin-btn admin-btn--secondary-solid" type="submit">Добавить администратора</button>
        </div>
      </form>
      <div id="admins-list" class="admin-admin-list"></div>
      </article>
    `,{title:"Заявки и настройки сайта",subtitle:"Заявки с формы; раздел «Статистика» — телеметрия с главной страницы; ниже — услуги, бюджет, текст для формы и администраторы.",eyebrow:"Админ-панель",showAdminLink:!1}),(e=document.querySelector(".page"))==null||e.classList.add("page--admin"),(n=document.querySelector(".card"))==null||n.classList.add("admin-card");const t=document.querySelector("#admin-config-form");t.addEventListener("submit",pe),document.querySelector("#logout-btn").addEventListener("click",ye),document.querySelector("#admin-create-form").addEventListener("submit",he),ne(),ae(),me(),oe(),z();try{const i=await ue();i?(t.querySelector("#config-id").value=i.id,b=Y(i.services_offered),h=-1,O(),t.querySelector("#budget_slider_config").value=pt(i.budget_slider_config),t.querySelector("#ui_options").value=ht(i.ui_options),m(`Загружена конфигурация ID: ${i.id}`,"success")):(b=[],h=-1,O(),t.querySelector("#budget_slider_config").value="",G={},t.querySelector("#ui_options").value="",m("Конфигурация пока не создана. Нажмите сохранить для создания.","success"))}catch(i){if(console.error(i),(i==null?void 0:i.message)==="UNAUTHORIZED"){await _(),m("Сессия истекла или токен недействителен. Войдите снова.","error");return}m("Не удалось загрузить настройки сайта. Проверьте доступность API и базы данных.","error")}await K();try{await wt()}catch(i){if(console.error(i),(i==null?void 0:i.message)==="UNAUTHORIZED"){await _(),m("Сессия истекла или токен недействителен. Войдите снова.","error");return}v((i==null?void 0:i.message)||"Не удалось загрузить заявки","error")}try{await P()}catch(i){if(console.error(i),(i==null?void 0:i.message)==="UNAUTHORIZED"){await _(),m("Сессия истекла или токен недействителен. Войдите снова.","error");return}x((i==null?void 0:i.message)||"Не удалось загрузить статистику (проверьте таблицу page_behavior_telemetry).","error")}}async function be(t){t.preventDefault();const e=document.querySelector("#admin-login-form");if(!e)return;const n=e.querySelector("#admin-login").value.trim().toLowerCase(),i=e.querySelector("#admin-password").value;if(!n||!i){m("Введите логин и пароль","error");return}try{const a=await g("/api/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({login:n,password:i})});if(!a.ok){const s=await a.text();throw new Error(s||"Неверные учетные данные")}const r=await a.json();w(r.token),await Q()}catch(a){m((a==null?void 0:a.message)||"Ошибка входа","error")}}async function ge(t){t.preventDefault();const e=document.querySelector("#admin-register-form");if(!e)return;const n=e.querySelector("#register-login").value.trim().toLowerCase(),i=e.querySelector("#register-password").value;if(!n||!i){m("Введите логин и пароль для регистрации","error");return}try{const a=await g("/api/v1/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({login:n,password:i})});if(!a.ok){const s=await a.text();throw new Error(s||"Регистрация недоступна")}const r=await a.json();w(r.token),await Q()}catch(a){m((a==null?void 0:a.message)||"Ошибка регистрации","error")}}async function _(){let t=!0,e=!1;try{const i=await g("/api/v1/auth/bootstrap");i.ok?(e=!0,t=!!(await i.json()).has_admins):t=!1}catch(i){console.error(i),t=!1}X(`
      ${t&&e?'<p class="status">Регистрация скрыта: в базе уже есть хотя бы один администратор. Войдите под существующим логином.</p>':e?"":'<p class="status">Не удалось проверить наличие админов. Если вы первый администратор, используйте форму ниже; иначе сервер отклонит регистрацию.</p>'}
      <form id="admin-login-form" class="form" novalidate>
        <label class="field" for="admin-login">
          <span>Логин</span>
          <input id="admin-login" type="text" minlength="3" maxlength="128" autocomplete="off" required />
        </label>
        <label class="field" for="admin-password">
          <span>Пароль</span>
          <input id="admin-password" type="password" minlength="6" maxlength="200" required />
        </label>
        <button class="submit-btn" type="submit">Войти</button>
      </form>
      ${t?"":`
        <hr />
        <form id="admin-register-form" class="form" novalidate>
          <label class="field" for="register-login">
            <span>Логин первого администратора</span>
            <input id="register-login" type="text" minlength="3" maxlength="128" autocomplete="off" required />
          </label>
          <label class="field" for="register-password">
            <span>Пароль</span>
            <input id="register-password" type="password" minlength="6" maxlength="200" required />
          </label>
          <button class="submit-btn" type="submit">Зарегистрироваться</button>
        </form>
      `}
      <p id="status" class="status" role="status" aria-live="polite"></p>
    `,{title:"Вход в админ-панель",subtitle:"Авторизация выполняется по логину и паролю с выдачей JWT токена.",eyebrow:"Вход администратора",showAdminLink:!1}),document.querySelector("#admin-login-form").addEventListener("submit",be),t||document.querySelector("#admin-register-form").addEventListener("submit",ge)}async function ve(){if(!ut()){await _();return}try{if((await g("/api/v1/admin-config?limit=1&offset=0&sort=desc",{},{requiresAuth:!0})).status===401){w(""),await _(),m("Сессия недействительна. Войдите снова.","error");return}}catch(t){console.error(t),w(""),await _();return}await Q()}function we(){if(window.location.pathname.startsWith("/admin")){ve();return}Yt()}we();
