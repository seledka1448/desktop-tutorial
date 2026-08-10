'use strict';

const DEFAULT_STATUSES=[
{id:'checking',name:'На проверке',color:'#3498db',textColor:'#fff'},
{id:'contacted',name:'Связались с клиентом',color:'#9b59b6',textColor:'#fff'},
{id:'waiting',name:'Ожидает ответа',color:'#f1c40f',textColor:'#000'},
{id:'irrelevant',name:'Неактуально',color:'#e74c3c',textColor:'#fff'}
];

const DEFAULT_ORDER_DENSITY='normal';

let statuses=[];
let statusesLoaded=false;
let saveTimer=null;

const tabs=document.querySelectorAll('.tab');
const contents=document.querySelectorAll('.tab-content');

function getDefaultStatuses(){
return DEFAULT_STATUSES.map(function(status){
return{
id:status.id,
name:status.name,
color:status.color,
textColor:status.textColor
};
});
}

tabs.forEach(function(tab){
tab.addEventListener('click',function(){
const target=tab.dataset.tab;

tabs.forEach(function(item){
item.classList.remove('active');
});

contents.forEach(function(content){
content.classList.remove('active');
});

tab.classList.add('active');

const targetContent=document.getElementById(target);

if(targetContent){
targetContent.classList.add('active');
}

if(target==='statuses'&&statusesLoaded){
renderStatuses();
}

if(target==='graphics'){
renderGraphics();
}
});
});

function loadStatuses(){
if(statusesLoaded){
return Promise.resolve();
}

return new Promise(function(resolve){
chrome.storage.local.get(['localStatuses'],function(result){

if(result&&Array.isArray(result.localStatuses)){

statuses=result.localStatuses.map(function(status){
return{
id:status.id,
name:status.name||'',
color:status.color||'#3498db',
textColor:status.textColor||'#fff'
};
});

}else{

statuses=getDefaultStatuses();

chrome.storage.local.set({
localStatuses:statuses
});

}

statusesLoaded=true;
resolve();

});
});
}

function saveStatuses(){
if(saveTimer){
clearTimeout(saveTimer);
}

saveTimer=setTimeout(function(){

chrome.storage.local.set({
localStatuses:statuses
});

saveTimer=null;

},150);
}

function renderStatuses(){

const container=document.getElementById('statuses');

if(!container){
return;
}

container.innerHTML='';

const header=document.createElement('div');
header.className='statuses-header';

const headerText=document.createElement('div');

const title=document.createElement('div');
title.className='section-title';
title.textContent='Локальные статусы';

const description=document.createElement('div');
description.className='section-description';
description.textContent='Эти статусы используются только внутри расширения.';

headerText.appendChild(title);
headerText.appendChild(description);

const addButton=document.createElement('button');
addButton.className='add-status-button';
addButton.id='addStatus';
addButton.type='button';
addButton.textContent='+ Добавить';
addButton.addEventListener('click',addStatus);

header.appendChild(headerText);
header.appendChild(addButton);

container.appendChild(header);

const list=document.createElement('div');
list.className='statuses-list';

for(let i=0;i<statuses.length;i++){
list.appendChild(createStatusItem(statuses[i],i));
}

container.appendChild(list);
}

function createStatusItem(status,index){

const item=document.createElement('div');
item.className='status-item';

const colors=document.createElement('div');
colors.className='status-colors';

const colorInput=document.createElement('input');
colorInput.type='color';
colorInput.className='status-color';
colorInput.value=status.color||'#3498db';
colorInput.title='Цвет фона';

const textColors=document.createElement('div');
textColors.className='status-text-colors';

const black=document.createElement('button');
black.type='button';
black.className='text-color-option black';
black.textContent='A';
black.title='Чёрный текст';

const white=document.createElement('button');
white.type='button';
white.className='text-color-option white';
white.textContent='A';
white.title='Белый текст';

const nameInput=document.createElement('input');
nameInput.type='text';
nameInput.className='status-name';
nameInput.value=status.name||'';
nameInput.placeholder='Название статуса';

const preview=document.createElement('span');
preview.className='status-preview';
preview.textContent=status.name||'';

const deleteButton=document.createElement('button');
deleteButton.className='delete-status';
deleteButton.type='button';
deleteButton.title='Удалить статус';
deleteButton.textContent='×';

function updateTextColor(){

const color=status.textColor||'#fff';

black.classList.toggle('active',color==='#000');
white.classList.toggle('active',color==='#fff');

preview.style.color=color;
}

function updatePreview(){

preview.style.backgroundColor=status.color||'#3498db';
preview.style.color=status.textColor||'#fff';
preview.textContent=status.name||'';
}

function setTextColor(color){

if(!statuses[index]){
return;
}

statuses[index].textColor=color;

updateTextColor();
saveStatuses();
}

colorInput.addEventListener('input',function(){

if(!statuses[index]){
return;
}

statuses[index].color=colorInput.value;
preview.style.backgroundColor=colorInput.value;

saveStatuses();
});

black.addEventListener('click',function(){
setTextColor('#000');
});

white.addEventListener('click',function(){
setTextColor('#fff');
});

nameInput.addEventListener('input',function(){

if(!statuses[index]){
return;
}

statuses[index].name=nameInput.value;
preview.textContent=nameInput.value;

saveStatuses();
});

deleteButton.addEventListener('click',function(){

const name=status.name||'Без названия';

if(!window.confirm('Удалить статус "'+name+'"?')){
return;
}

statuses.splice(index,1);

saveStatuses();
renderStatuses();
});

updatePreview();
updateTextColor();

textColors.appendChild(black);
textColors.appendChild(white);

colors.appendChild(colorInput);
colors.appendChild(textColors);

item.appendChild(colors);
item.appendChild(nameInput);
item.appendChild(preview);
item.appendChild(deleteButton);

return item;
}

function addStatus(){

const newStatus={
id:'status_'+Date.now(),
name:'Новый статус',
color:'#95a5a6',
textColor:'#fff'
};

statuses.push(newStatus);

saveStatuses();
renderStatuses();

const inputs=document.querySelectorAll('.status-name');

if(!inputs.length){
return;
}

const lastInput=inputs[inputs.length-1];

if(lastInput){
lastInput.focus();
lastInput.select();
}
}

function renderGraphics(){

const container=document.getElementById('graphics');

if(!container){
return;
}

container.innerHTML='';

const section=document.createElement('div');
section.className='graphics-section';

const title=document.createElement('div');
title.className='section-title';
title.textContent='Плотность строк заказов';

const description=document.createElement('div');
description.className='section-description';
description.textContent='Настройка высоты строк в списке заказов.';

const options=document.createElement('div');
options.className='density-options';

const values=[
{
value:'normal',
title:'Обычная',
description:'Стандартная высота'
},
{
value:'compact',
title:'Компактная',
description:'Больше заказов на экране'
},
{
value:'ultra',
title:'Максимальная',
description:'Максимальная плотность'
}
];

values.forEach(function(item){

const label=document.createElement('label');
label.className='density-option';

const input=document.createElement('input');

input.type='radio';
input.name='orderDensity';
input.value=item.value;

const text=document.createElement('div');
text.className='density-option-text';

const name=document.createElement('div');
name.className='density-option-title';
name.textContent=item.title;

const desc=document.createElement('div');
desc.className='density-option-description';
desc.textContent=item.description;

text.appendChild(name);
text.appendChild(desc);

label.appendChild(input);
label.appendChild(text);

input.addEventListener('change',function(){

if(!input.checked){
return;
}

saveOrderDensity(input.value);

});

options.appendChild(label);

});

section.appendChild(title);
section.appendChild(description);
section.appendChild(options);

container.appendChild(section);

loadOrderDensity();

}

function loadOrderDensity(){

chrome.storage.local.get(
['orderDensity'],
function(result){

const density=
result&&result.orderDensity
?result.orderDensity
:DEFAULT_ORDER_DENSITY;

const input=document.querySelector(
'input[name="orderDensity"][value="'+density+'"]'
);

if(input){
input.checked=true;
}

});
}

function saveOrderDensity(density){

chrome.storage.local.set({
orderDensity:density
});

chrome.tabs.query({},function(tabs){

tabs.forEach(function(tab){

if(!tab.id){
return;
}

chrome.tabs.sendMessage(
tab.id,
{
type:'orderDensityChanged',
density:density
},
function(){
void chrome.runtime.lastError;
}
);

});

});

}

loadStatuses().then(function(){

renderGraphics();

const activeTab=document.querySelector('.tab.active');

if(activeTab&&activeTab.dataset.tab==='statuses'){
renderStatuses();
}

});