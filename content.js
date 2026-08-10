(()=>{
'use strict';

const ROW='tr.p-selectable-row.table-row';
const DEVICE='a[href*="/devices/order/0/device/"]';
const TITLE='Статус устройства';
const TIME='localStatusTimes';
const DENSITY='orderDensity';
const CSS_ID='gs-order-density-css';

const DEFAULT=[
{id:'checking',name:'На проверке',color:'#3498db',textColor:'#fff'},
{id:'contacted',name:'Связались с клиентом',color:'#9b59b6',textColor:'#fff'},
{id:'waiting',name:'Ожидает ответа',color:'#f1c40f',textColor:'#000'},
{id:'irrelevant',name:'Неактуально',color:'#e74c3c',textColor:'#fff'}
];

let statuses=[];
let times={};
let panel=null;
let trigger=null;
let density='normal';

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];

const storage={
get:key=>new Promise(r=>{
chrome.storage.local.get(key,x=>r(x||{}));
}),
set:data=>new Promise(r=>{
chrome.storage.local.set(data,r);
})
};


/* =========================================
   ПЛОТНОСТЬ
   ========================================= */

function normalizeDensity(value){
return['normal','compact','ultra'].includes(value)
?value
:'normal';
}

function applyDensity(value){

density=normalizeDensity(value);

const html=document.documentElement;

if(!html)return;

html.classList.remove(
'gs-order-density-normal',
'gs-order-density-compact',
'gs-order-density-ultra'
);

html.classList.add(
'gs-order-density-'+density
);

}

function loadDensity(){

return storage.get([DENSITY]).then(data=>{
applyDensity(
data[DENSITY]||'normal'
);
});

}

function loadDensityCss(){

if(document.getElementById(CSS_ID))
return;

const link=document.createElement('link');

link.id=CSS_ID;
link.rel='stylesheet';
link.type='text/css';
link.href=chrome.runtime.getURL(
'order-density.css'
);

(document.head||document.documentElement)
.appendChild(link);

}

function setDensity(value){

const newDensity=normalizeDensity(value);

applyDensity(newDensity);

storage.set({
[DENSITY]:newDensity
});

}


/* =========================================
   СООБЩЕНИЕ ИЗ POPUP
   ========================================= */

chrome.runtime.onMessage.addListener(message=>{

if(!message)return;

if(message.type==='orderDensityChanged'){

setDensity(message.density);

}

});


/* =========================================
   STORAGE
   ========================================= */

chrome.storage.onChanged.addListener(
(changes,area)=>{

if(area!=='local')
return;

if(changes[DENSITY]){

applyDensity(
changes[DENSITY].newValue
);

}

if(changes.localStatuses){

loadStatusesOnly();

}

if(changes[TIME]){

times=
changes[TIME].newValue||{};

refreshAllLocalStatusTimes();

}

});


/* =========================================
   ЗАГРУЗКА
   ========================================= */

async function load(){

const data=await storage.get([
'localStatuses',
TIME,
DENSITY
]);

statuses=Array.isArray(
data.localStatuses
)
?data.localStatuses.map(x=>({
id:x.id,
name:x.name||'',
color:x.color||'#3498db',
textColor:x.textColor||'#fff'
}))
:DEFAULT.map(x=>({...x}));

times=
data[TIME]&&
typeof data[TIME]==='object'
?data[TIME]
:{};

density=normalizeDensity(
data[DENSITY]||'normal'
);

applyDensity(density);

if(!Array.isArray(data.localStatuses)){

await storage.set({
localStatuses:statuses
});

}

}

async function loadStatusesOnly(){

const data=await storage.get([
'localStatuses'
]);

if(!Array.isArray(data.localStatuses))
return;

statuses=data.localStatuses.map(x=>({
id:x.id,
name:x.name||'',
color:x.color||'#3498db',
textColor:x.textColor||'#fff'
}));

refreshAllLocalStatuses();

}


/* =========================================
   ID ЗАКАЗА
   ========================================= */

function getId(row){

const link=$(DEVICE,row);

if(!link)
return null;

const href=link.getAttribute('href');

if(!href)
return null;

const match=href.match(
/\/devices\/order\/0\/device\/([^/?#]+)/
);

return match?match[1]:null;

}


/* =========================================
   ЯЧЕЙКА СТАТУСА
   ========================================= */

function getCell(row){

return $$('td',row).find(cell=>{

const title=$('.p-column-title',cell);

return title&&
title.textContent.trim()===TITLE;

})||null;

}

function getNative(row){

const cell=getCell(row);

return cell
?$('p-dropdown',cell)
:null;

}

function getStatus(id){

return statuses.find(
x=>x.id===id
)||null;

}


/* =========================================
   DROPDOWN
   ========================================= */

function close(){

if(panel)
panel.remove();

panel=null;
trigger=null;

}

function position(){

if(!panel||!trigger)
return;

const r=
trigger.getBoundingClientRect();

const w=
Math.round(r.width);

const h=Math.min(
statuses.length*40+50,
Math.max(160,innerHeight-10)
);

panel.style.width=w+'px';
panel.style.minWidth=w+'px';
panel.style.maxWidth=w+'px';

panel.style.left=
Math.round(r.left)+'px';

panel.style.top=
r.bottom+h<=innerHeight
?r.bottom+'px'
:Math.max(5,r.top-h)+'px';

}


/* =========================================
   BACKGROUND
   ========================================= */

function send(action,id,status){

try{

chrome.runtime.sendMessage({
action,
deviceId:id,
status
});

}catch(e){}

}


/* =========================================
   СОХРАНЕНИЕ
   ========================================= */

function saveStatus(id,statusId){

times[id]={
statusId:statusId,
updatedAt:Date.now()
};

storage.set({
[TIME]:times
});

send(
'setStatus',
id,
statusId
);

}

function resetStatus(id){

delete times[id];

storage.set({
[TIME]:times
});

send(
'setStatus',
id,
null
);

}


/* =========================================
   ПОЛУЧЕНИЕ СТАТУСА
   ========================================= */

function getSaved(id){

return new Promise(resolve=>{

try{

chrome.runtime.sendMessage(
{
action:'getStatus',
deviceId:id
},
response=>{

if(
chrome.runtime.lastError||
!response?.success
){

resolve(null);
return;

}

resolve(
response.data?.status||null
);

}
);

}catch(e){

resolve(null);

}

});

}


/* =========================================
   TAG
   ========================================= */

function makeTag(status){

const tag=document.createElement('span');

tag.className=
'gs-local-status-tag';

tag.textContent=
status.name||'';

tag.style.backgroundColor=
status.color||'#3498db';

tag.style.color=
status.textColor||'#fff';

return tag;

}


/* =========================================
   OPTION
   ========================================= */

function addOption(
list,
status,
id,
update,
selected
){

const item=document.createElement('li');

item.className=
'p-ripple p-element p-dropdown-item '+
'gs-local-status-option';

item.setAttribute(
'role',
'option'
);

item.setAttribute(
'aria-label',
status.name
);

item.setAttribute(
'aria-selected',
selected?'true':'false'
);

if(selected){

item.classList.add(
'p-highlight',
'p-focus'
);

}

const content=
document.createElement('div');

content.className=
'gs-local-status-label';

content.appendChild(
makeTag(status)
);

item.appendChild(content);

item.addEventListener(
'click',
e=>{

e.preventDefault();
e.stopPropagation();

saveStatus(
id,
status.id
);

update(status.id);

close();

}
);

list.appendChild(item);

}


/* =========================================
   RESET
   ========================================= */

function addReset(
list,
id,
update,
selected
){

const item=document.createElement('li');

item.className=
'p-ripple p-element p-dropdown-item '+
'gs-local-status-option '+
'gs-local-status-reset';

item.setAttribute(
'role',
'option'
);

item.setAttribute(
'aria-label',
'Без статуса'
);

item.setAttribute(
'aria-selected',
selected?'true':'false'
);

if(selected){

item.classList.add(
'p-highlight',
'p-focus'
);

}

item.innerHTML=
'<span>Без статуса</span>';

item.addEventListener(
'click',
e=>{

e.preventDefault();
e.stopPropagation();

resetStatus(id);

update(null);

close();

}
);

list.appendChild(item);

}


/* =========================================
   СОЗДАНИЕ DROPDOWN
   ========================================= */

function create(row,id,selected){

const cell=getCell(row);
const native=getNative(row);

if(
!cell||
!native||
$('.gs-local-status-dropdown',cell)
)
return;

const wrap=
document.createElement('div');

wrap.className=
'gs-local-status-dropdown';

wrap.dataset.deviceId=id;

const dropdown=
document.createElement('div');

dropdown.className=
'p-dropdown p-component '+
'p-inputwrapper p-inputwrapper-filled';

const label=
document.createElement('span');

label.className=
'p-dropdown-label p-inputtext';

label.setAttribute(
'role',
'combobox'
);

label.setAttribute(
'aria-haspopup',
'listbox'
);

label.tabIndex=0;

const triggerEl=
document.createElement('div');

triggerEl.className=
'p-dropdown-trigger';

triggerEl.setAttribute(
'role',
'button'
);

triggerEl.setAttribute(
'aria-label',
'dropdown trigger'
);

triggerEl.setAttribute(
'aria-haspopup',
'listbox'
);

triggerEl.innerHTML=
'<span class="p-dropdown-trigger-icon">'+
'<i class="pi pi-chevron-down"></i>'+
'</span>';

dropdown.append(
label,
triggerEl
);

wrap.appendChild(dropdown);

const time=
document.createElement('div');

time.className=
'gs-local-status-time';

wrap.appendChild(time);

native.after(wrap);


/* =========================================
   UPDATE
   ========================================= */

function update(statusId){

const status=
getStatus(statusId);

label.innerHTML='';

if(status){

const content=
document.createElement('div');

content.className=
'gs-local-status-label';

content.appendChild(
makeTag(status)
);

label.appendChild(content);

}else{

label.textContent=
'Без статуса';

}

wrap.dataset.statusId=
statusId||'';

const saved=times[id];

if(
saved?.statusId===statusId&&
saved.updatedAt
){

time.textContent=
'Изменён: '+
new Date(
saved.updatedAt
).toLocaleString(
'ru-RU',
{
day:'2-digit',
month:'2-digit',
year:'numeric',
hour:'2-digit',
minute:'2-digit'
}
);

time.style.display='block';

}else{

time.textContent='';

time.style.display='none';

}

}


/* =========================================
   ОТКРЫТИЕ
   ========================================= */

function openMenu(){

if(trigger===dropdown){

close();

return;

}

close();

panel=
document.createElement('div');

panel.className=
'p-overlay p-component '+
'gs-local-status-overlay';

panel.innerHTML=
'<div class="p-overlay-content">'+
'<div class="p-dropdown-panel p-component gs-local-status-panel">'+
'<div class="p-dropdown-items-wrapper gs-local-status-items-wrapper">'+
'<ul class="p-dropdown-items gs-local-status-items" role="listbox"></ul>'+
'</div>'+
'</div>'+
'</div>';

document.body.appendChild(panel);

trigger=dropdown;

const list=$(
'.gs-local-status-items',
panel
);

statuses.forEach(status=>{

if(
status?.id&&
status?.name
){

addOption(
list,
status,
id,
update,
status.id===selected
);

}

});

addReset(
list,
id,
update,
!selected
);

position();

dropdown.classList.add(
'p-inputwrapper-focus'
);

}


/* =========================================
   EVENTS
   ========================================= */

dropdown.addEventListener(
'click',
e=>{

e.preventDefault();
e.stopPropagation();

openMenu();

}
);

dropdown.addEventListener(
'mousedown',
e=>{
e.stopPropagation();
}
);

label.addEventListener(
'keydown',
e=>{

if(
e.key==='Enter'||
e.key===' '
){

e.preventDefault();
e.stopPropagation();

openMenu();

}

}
);

update(selected);

}


/* =========================================
   PROCESS
   ========================================= */

async function process(row){

if(
!row||
!row.matches(ROW)
)
return;

if(
$('.gs-local-status-dropdown',row)
)
return;

const id=getId(row);

if(
!id||
!getNative(row)
)
return;

const selected=
await getSaved(id);

if(!document.contains(row))
return;

create(
row,
id,
selected
);

}


/* =========================================
   ОБНОВЛЕНИЕ СТАТУСОВ
   ========================================= */

function refreshAllLocalStatuses(){

$$(
'.gs-local-status-dropdown'
).forEach(wrap=>{

const statusId=
wrap.dataset.statusId||null;

const label=
$('.p-dropdown-label',wrap);

if(!label)
return;

const status=
getStatus(statusId);

label.innerHTML='';

if(status){

const content=
document.createElement('div');

content.className=
'gs-local-status-label';

content.appendChild(
makeTag(status)
);

label.appendChild(content);

}else{

label.textContent=
'Без статуса';

}

});

}

function refreshAllLocalStatusTimes(){

$$(
'.gs-local-status-dropdown'
).forEach(wrap=>{

const id=
wrap.dataset.deviceId;

const time=
$('.gs-local-status-time',wrap);

if(!id||!time)
return;

const saved=times[id];

if(saved?.updatedAt){

time.textContent=
'Изменён: '+
new Date(
saved.updatedAt
).toLocaleString(
'ru-RU',
{
day:'2-digit',
month:'2-digit',
year:'numeric',
hour:'2-digit',
minute:'2-digit'
}
);

time.style.display='block';

}else{

time.textContent='';
time.style.display='none';

}

});

}


/* =========================================
   TABLE OBSERVER
   ========================================= */

function observe(tbody){

tbody
.querySelectorAll(ROW)
.forEach(process);

new MutationObserver(
mutations=>{

mutations.forEach(
mutation=>{

mutation.addedNodes.forEach(
node=>{

if(node.nodeType!==1)
return;

if(node.matches?.(ROW))
process(node);

node
.querySelectorAll?.(ROW)
.forEach(process);

}
);

}
);

}
).observe(
tbody,
{
childList:true,
subtree:true
}
);

}


/* =========================================
   GLOBAL
   ========================================= */

document.addEventListener(
'click',
e=>{

if(
panel&&
!panel.contains(e.target)&&
!trigger?.contains(e.target)
){

close();

}

},
true
);

document.addEventListener(
'keydown',
e=>{

if(e.key==='Escape')
close();

}
);

addEventListener(
'resize',
position
);

addEventListener(
'scroll',
position,
true
);


/* =========================================
   START
   ========================================= */

async function start(){

await loadDensity();

loadDensityCss();

await load();

let tbody=
document.querySelector('tbody');

if(!tbody){

setTimeout(
start,
500
);

return;

}

observe(tbody);

let current=tbody;

new MutationObserver(()=>{

const next=
document.querySelector('tbody');

if(
next&&
next!==current
){

current=next;

observe(current);

}

}).observe(
document.body,
{
childList:true,
subtree:true
}
);

}

start();

})();