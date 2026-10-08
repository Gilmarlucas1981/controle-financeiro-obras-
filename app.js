const KEY='controle_obras_v1';
let state=loadState();
function loadState(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x||structuredClone(window.SEED_DATA)}catch(e){return structuredClone(window.SEED_DATA)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=(v,d=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
function go(id){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');scrollTo(0,0);if(id==='home')renderDashboard();if(id==='launch'){fillSelects();renderLaunches();previewLaunch()}if(id==='registers')renderRegisters();if(id==='dre')renderDRE()}
function isoToday(){return new Date().toISOString().slice(0,10)}
function monthStart(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
function sum(a,fn){return a.reduce((s,x)=>s+Number(fn(x)||0),0)}
function rangeData(start,end){return state.daily.filter(x=>(!start||x.date>=start)&&(!end||x.date<=end))}
function contractFor(obra,equipe){return state.contracts.find(x=>x.obra===obra&&x.equipe===equipe)}
function equipDay(obra,equipe){return sum(state.equipments.filter(x=>x.ativo&&x.obra===obra&&x.equipe===equipe),x=>x.mensal/(x.diasMes||26))}
function peopleDay(obra,equipe){
 const c=contractFor(obra,equipe);const days=c?.diasMes||26;
 const ps=state.collaborators.filter(x=>x.obra===obra&&x.equipe===equipe);
 return {folha:sum(ps,x=>x.salary/days),inss:sum(ps,x=>(x.salary*(x.inss/100))/days),fgts:sum(ps,x=>(x.salary*(x.fgts/100))/days)}
}
function renderDashboard(){
 const s=filterStart.value||monthStart(),e=filterEnd.value||isoToday();filterStart.value=s;filterEnd.value=e;
 const data=rangeData(s,e); const receita=sum(data,x=>x.receita),custo=sum(data,x=>x.custo),res=receita-custo,margem=receita?res/receita:0;
 kpis.innerHTML=`<div class="kpi"><span>Receita</span><b>${brl(receita)}</b></div><div class="kpi"><span>Custos</span><b>${brl(custo)}</b></div><div class="kpi ${res>=0?'good':'bad'}"><span>Resultado</span><b>${brl(res)}</b></div><div class="kpi ${margem>=0?'good':'bad'}"><span>Margem</span><b>${num(margem*100,1)}%</b></div>`;
 const map={};data.forEach(x=>{const k=x.obra+'|'+x.equipe;if(!map[k])map[k]={obra:x.obra,equipe:x.equipe,prodT:0,prodM2:0,receita:0,custo:0};const m=map[k];if(x.unidade==='m²')m.prodM2+=x.producao;else m.prodT+=x.producao;m.receita+=x.receita;m.custo+=x.custo});
 summaryList.innerHTML=Object.values(map).sort((a,b)=>(b.receita-b.custo)-(a.receita-a.custo)).map(x=>{const r=x.receita-x.custo,mg=x.receita?r/x.receita:0;return `<div class="summary-card"><div class="head"><div><b>${x.obra}</b><div class="meta">${x.equipe}</div></div><div class="money ${r>=0?'good':'bad'}">${brl(r)}</div></div><div class="mini-grid"><div><span>Receita</span><b>${brl(x.receita)}</b></div><div><span>Custo</span><b>${brl(x.custo)}</b></div><div><span>Margem</span><b>${num(mg*100,1)}%</b></div><div><span>Produção t</span><b>${num(x.prodT,2)}</b></div><div><span>Produção m²</span><b>${num(x.prodM2,2)}</b></div></div></div>`}).join('')||'<div class="card">Sem lançamentos no período.</div>'
}
function fillSelect(el,values){const cur=el.value;el.innerHTML=values.map(x=>`<option>${x}</option>`).join('');if(values.includes(cur))el.value=cur}
function fillSelects(){
 const obs=[...new Set([...state.obras,...state.contracts.map(x=>x.obra)])];const eqs=[...new Set([...state.equipes,...state.contracts.map(x=>x.equipe)])];
 [lObra,eObra,pObra].forEach(x=>fillSelect(x,obs));[lEquipe,eEquipe,pEquipe].forEach(x=>fillSelect(x,eqs));
 if(!lDate.value)lDate.value=isoToday();refreshLaunchDefaults()
}
function refreshLaunchDefaults(){const c=contractFor(lObra.value,lEquipe.value);lContract.value=lUnit.value==='m²'?(c?.contratoM2||0):(c?.contratoTon||0);previewLaunch()}
['lProd','lContract','lFuel','lToll','lMaint','lOther'].forEach(id=>document.addEventListener('input',e=>{if(e.target.id===id)previewLaunch()}))
function calcLaunch(){
 const obra=lObra.value,equipe=lEquipe.value,prod=Number(lProd.value||0),contr=Number(lContract.value||0);const receita=prod*contr;
 const c=contractFor(obra,equipe)||{};const p=peopleDay(obra,equipe);const eq=equipDay(obra,equipe);const iss=receita*Number(c.issPct||0)/100;
 const fuel=Number(lFuel.value||0),toll=Number(lToll.value||0),maint=Number(lMaint.value||0),other=Number(lOther.value||0);
 const custo=p.folha+p.inss+p.fgts+iss+eq+fuel+toll+maint+other,res=receita-custo,mg=receita?res/receita:0;
 return {receita,folha:p.folha,inss:p.inss,fgts:p.fgts,iss,equipamentos:eq,custo,resultado:res,margem:mg,custoUnidade:prod?custo/prod:0}
}
function previewLaunch(){if(!window.lObra)return;const x=calcLaunch();launchPreview.innerHTML=`Receita <b>${brl(x.receita)}</b> · Custos <b>${brl(x.custo)}</b><br>Resultado <b class="${x.resultado>=0?'money good':'money bad'}">${brl(x.resultado)}</b> · Margem ${num(x.margem*100,1)}%`}
function saveLaunch(){
 const x=calcLaunch();state.daily.push({id:'n-'+Date.now(),date:lDate.value,obra:lObra.value,equipe:lEquipe.value,producao:Number(lProd.value||0),unidade:lUnit.value,contrato:Number(lContract.value||0),receita:x.receita,folha:x.folha,inss:x.inss,fgts:x.fgts,iss:x.iss,equipamentos:x.equipamentos,combustivel:Number(lFuel.value||0),pedagio:Number(lToll.value||0),manutencao:Number(lMaint.value||0),outras:Number(lOther.value||0),custo:x.custo,resultado:x.resultado,margem:x.margem,custoUnidade:x.custoUnidade,alerta:x.resultado<0?'ALERTA: PREJUÍZO':'LUCRO',imported:false});save();renderLaunches();alert('Lançamento salvo.')}
function renderLaunches(){const q=(launchSearch.value||'').toLowerCase();const list=[...state.daily].reverse().filter(x=>(x.obra+' '+x.equipe).toLowerCase().includes(q)).slice(0,100);launchList.innerHTML=list.map(x=>`<div class="list-card"><div class="head"><div><b>${x.obra} · ${x.equipe}</b><div class="meta">${x.date.split('-').reverse().join('/')} · ${num(x.producao,3)} ${x.unidade}</div></div><div class="money ${x.resultado>=0?'good':'bad'}">${brl(x.resultado)}</div></div><div class="mini-grid"><div><span>Receita</span><b>${brl(x.receita)}</b></div><div><span>Custo</span><b>${brl(x.custo)}</b></div><div><span>Margem</span><b>${num(x.margem*100,1)}%</b></div></div></div>`).join('')}
function regTab(name,btn){document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.regpane').forEach(x=>x.classList.remove('active'));document.getElementById('reg'+name[0].toUpperCase()+name.slice(1)).classList.add('active')}
function renderRegisters(){fillSelects();contractList.innerHTML=state.contracts.map((x,i)=>`<div class="list-card"><div class="head"><div><b>${x.obra}</b><div class="meta">${x.equipe} · ${x.diasMes} dias/mês</div></div><button onclick="delContract(${i})">Excluir</button></div><div class="mini-grid"><div><span>R$/t</span><b>${brl(x.contratoTon)}</b></div><div><span>R$/m²</span><b>${brl(x.contratoM2)}</b></div><div><span>ISS</span><b>${num(x.issPct,2)}%</b></div></div></div>`).join('');
 equipmentList.innerHTML=state.equipments.map((x,i)=>`<div class="list-card"><div class="head"><div><b>${x.descricao}</b><div class="meta">${x.obra} · ${x.equipe}</div></div><button onclick="delEquipment(${i})">Excluir</button></div><div class="meta">${brl(x.mensal)}/mês · ${brl(x.mensal/(x.diasMes||26))}/dia · ${x.ativo?'Ativo':'Inativo'}</div></div>`).join('');
 peopleList.innerHTML=state.collaborators.map((x,i)=>`<div class="list-card"><div class="head"><div><b>${x.name}</b><div class="meta">${x.obra} · ${x.equipe}</div></div><button onclick="delPerson(${i})">Excluir</button></div><div class="meta">Salário ${brl(x.salary)} · INSS ${num(x.inss,2)}% · FGTS ${num(x.fgts,2)}%</div></div>`).join('')||'<div class="card">Nenhum colaborador cadastrado no app ainda.</div>'}
function addContract(){const x={obra:cObra.value.trim(),equipe:cEquipe.value.trim(),diasMes:Number(cDias.value||26),issPct:Number(cIss.value||0),contratoTon:Number(cTon.value||0),contratoM2:Number(cM2.value||0),obs:''};if(!x.obra||!x.equipe)return alert('Informe obra e equipe.');state.contracts.push(x);if(!state.obras.includes(x.obra))state.obras.push(x.obra);if(!state.equipes.includes(x.equipe))state.equipes.push(x.equipe);save();renderRegisters()}
function addEquipment(){const x={id:'eq-'+Date.now(),descricao:eDesc.value.trim(),obra:eObra.value,equipe:eEquipe.value,mensal:Number(eMonthly.value||0),diasMes:Number(eDays.value||26),ativo:true};if(!x.descricao)return alert('Informe a descrição.');state.equipments.push(x);save();renderRegisters()}
function addPerson(){const x={id:'p-'+Date.now(),name:pName.value.trim(),obra:pObra.value,equipe:pEquipe.value,salary:Number(pSalary.value||0),inss:Number(pInss.value||0),fgts:Number(pFgts.value||0)};if(!x.name)return alert('Informe o nome.');state.collaborators.push(x);save();renderRegisters()}
function delContract(i){if(confirm('Excluir contrato?')){state.contracts.splice(i,1);save();renderRegisters()}}
function delEquipment(i){if(confirm('Excluir equipamento?')){state.equipments.splice(i,1);save();renderRegisters()}}
function delPerson(i){if(confirm('Excluir colaborador?')){state.collaborators.splice(i,1);save();renderRegisters()}}
function dreRow(a,b,cls=''){return `<div class="dre-row ${cls}"><span>${a}</span><b>${b}</b></div>`}
function renderDRE(){
 const s=dreStart.value||monthStart(),e=dreEnd.value||isoToday();dreStart.value=s;dreEnd.value=e;const d=rangeData(s,e);
 const receita=sum(d,x=>x.receita),folha=sum(d,x=>x.folha),inss=sum(d,x=>x.inss),fgts=sum(d,x=>x.fgts),iss=sum(d,x=>x.iss),equip=sum(d,x=>x.equipamentos),fuel=sum(d,x=>x.combustivel),toll=sum(d,x=>x.pedagio),maint=sum(d,x=>x.manutencao),other=sum(d,x=>x.outras),cost=folha+inss+fgts+iss+equip+fuel+toll+maint+other,res=receita-cost,mg=receita?res/receita:0;
 const pt=sum(d.filter(x=>x.unidade!=='m²'),x=>x.producao),pm=sum(d.filter(x=>x.unidade==='m²'),x=>x.producao);
 dreContent.innerHTML=`<div class="card">${dreRow('Produção em toneladas',num(pt,3)+' t')}${dreRow('Produção em m²',num(pm,2)+' m²')}${dreRow('Receita da produção',brl(receita),'total')}</div><div class="card">${dreRow('Folha bruta',brl(folha))}${dreRow('INSS',brl(inss))}${dreRow('FGTS',brl(fgts))}${dreRow('ISS',brl(iss))}${dreRow('Locação de equipamentos',brl(equip))}${dreRow('Combustível',brl(fuel))}${dreRow('Pedágio',brl(toll))}${dreRow('Manutenção',brl(maint))}${dreRow('Outras despesas',brl(other))}${dreRow('TOTAL DE CUSTOS',brl(cost),'total')}</div><div class="card">${dreRow('Lucro / prejuízo',brl(res),'total')}${dreRow('Margem',num(mg*100,2)+'%')}<div class="dre-status ${res>=0?'good':'bad'}">${res>=0?'LUCRO NO PERÍODO':'ALERTA: PREJUÍZO NO PERÍODO'}</div></div>`
}
function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup-controle-obras.json';a.click();URL.revokeObjectURL(a.href)}
filterStart.value=monthStart();filterEnd.value=isoToday();dreStart.value=monthStart();dreEnd.value=isoToday();lDate.value=isoToday();fillSelects();renderDashboard();