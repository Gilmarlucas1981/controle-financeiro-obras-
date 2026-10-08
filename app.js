const sb=window.supabase.createClient(CFG.url,CFG.key);
let state={obras:[],equipes:[],contracts:[],equipments:[],fixedCosts:[],collaborators:[],daily:[]};
let editingLaunchId=null;
let editingContractId=null;
let editingEquipmentId=null;
let editingFixedCostId=null;

const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=(v,d=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const sum=(a,fn)=>a.reduce((s,x)=>s+Number(fn(x)||0),0);
const isoToday=()=>new Date().toISOString().slice(0,10);
const monthStart=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`};

async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(session){
    login.classList.add('hidden');
    await loadCloud();
  }
  lDate.value=isoToday();
  filterStart.value=monthStart();filterEnd.value=isoToday();
  dreStart.value=monthStart();dreEnd.value=isoToday();
}
loginForm.onsubmit=async e=>{
  e.preventDefault();
  loginMsg.textContent='Entrando...';
  const {error}=await sb.auth.signInWithPassword({email:email.value,password:password.value});
  if(error){loginMsg.textContent='E-mail ou senha inválidos.';return}
  login.classList.add('hidden');loginMsg.textContent='';
  await loadCloud();
};
logout.onclick=async()=>{await sb.auth.signOut();login.classList.remove('hidden')};

async function loadCloud(){
  const [o,e,c,eq,fc,p,l]=await Promise.all([
    sb.from('obras').select('*').order('nome'),
    sb.from('equipes').select('*').order('nome'),
    sb.from('contratos_obra_equipe').select('*'),
    sb.from('equipamentos').select('*').order('descricao'),
    sb.from('custos_fixos_equipe').select('*'),
    sb.from('colaboradores').select('*').order('nome'),
    sb.from('lancamentos_diarios').select('*').order('data',{ascending:true}).order('id',{ascending:true})
  ]);
  const err=[o,e,c,eq,fc,p,l].find(x=>x.error);
  if(err){alert('Erro ao carregar dados: '+err.error.message);return}
  state.obras=o.data||[]; state.equipes=e.data||[];
  const om=Object.fromEntries(state.obras.map(x=>[x.id,x.nome]));
  const em=Object.fromEntries(state.equipes.map(x=>[x.id,x.nome]));
  state.contracts=(c.data||[]).map(x=>({
    id:x.id,obraId:x.obra_id,equipeId:x.equipe_id,obra:om[x.obra_id]||'',equipe:em[x.equipe_id]||'',
    diasMes:x.dias_trabalhados_mes,issPct:Number(x.iss_pct||0),contratoTon:Number(x.contrato_tonelada||0),
    contratoM2:Number(x.contrato_m2||0),obs:x.observacoes||'',ativo:x.ativo
  }));
  state.equipments=(eq.data||[]).map(x=>({
    id:x.id,descricao:x.descricao,obraId:x.obra_id,equipeId:x.equipe_id,obra:om[x.obra_id]||'',equipe:em[x.equipe_id]||'',
    mensal:Number(x.locacao_mensal||0),diasMes:x.dias_mes||26,diaria:Number(x.locacao_dia||0),ativo:x.ativo
  }));
  state.fixedCosts=(fc.data||[]).map(x=>({
    id:x.id,obraId:x.obra_id,equipeId:x.equipe_id,obra:om[x.obra_id]||'',equipe:em[x.equipe_id]||'',
    diasMes:Number(x.dias_mes||26),folhaMensal:Number(x.folha_mensal||0),inssMensal:Number(x.inss_mensal||0),
    fgtsMensal:Number(x.fgts_mensal||0),ativo:x.ativo
  }));
  state.collaborators=(p.data||[]).map(x=>({
    id:x.id,name:x.nome,obraId:x.obra_id,equipeId:x.equipe_id,obra:om[x.obra_id]||'',equipe:em[x.equipe_id]||'',
    salary:Number(x.salario_mensal||0),inss:Number(x.inss_pct||0),fgts:Number(x.fgts_pct||0),ativo:x.ativo
  }));
  state.daily=(l.data||[]).map(x=>({
    id:x.id,date:x.data,obraId:x.obra_id,equipeId:x.equipe_id,obra:om[x.obra_id]||'',equipe:em[x.equipe_id]||'',
    producao:Number(x.producao||0),unidade:x.unidade,contrato:Number(x.contrato_unidade||0),receita:Number(x.receita||0),
    folha:Number(x.folha_bruta_dia||0),inss:Number(x.inss_dia||0),fgts:Number(x.fgts_dia||0),iss:Number(x.iss_dia||0),
    equipamentos:Number(x.locacao_equipamentos_dia||0),combustivel:Number(x.combustivel||0),pedagio:Number(x.pedagio||0),
    manutencao:Number(x.manutencao||0),outras:Number(x.outras_despesas||0),custo:Number(x.custo_total||0),
    resultado:Number(x.lucro_prejuizo||0),margem:Number(x.margem||0),custoUnidade:Number(x.custo_unidade||0),
    alerta:x.alerta||''
  }));
  fillSelects();renderDashboard();renderLaunches();renderRegisters();renderDRE();
}

function go(id){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.getElementById(id).classList.add('active');scrollTo(0,0);
  if(id==='home')renderDashboard();
  if(id==='launch'){fillSelects();renderLaunches();previewLaunch()}
  if(id==='registers')renderRegisters();
  if(id==='dre')renderDRE();
}
function rangeData(start,end){return state.daily.filter(x=>(!start||x.date>=start)&&(!end||x.date<=end))}
function contractFor(obra,equipe){return state.contracts.find(x=>x.obra===obra&&x.equipe===equipe)}
function equipDay(obra,equipe){return sum(state.equipments.filter(x=>x.ativo&&x.obra===obra&&x.equipe===equipe),x=>x.mensal/(x.diasMes||26))}
function peopleDay(obra,equipe){
 const f=state.fixedCosts.find(x=>x.ativo!==false&&x.obra===obra&&x.equipe===equipe);
 if(f){
   const days=f.diasMes||26;
   return {folha:f.folhaMensal/days,inss:f.inssMensal/days,fgts:f.fgtsMensal/days,fonte:'mensal'};
 }
 const c=contractFor(obra,equipe),days=c?.diasMes||26,ps=state.collaborators.filter(x=>x.ativo&&x.obra===obra&&x.equipe===equipe);
 if(ps.length){
   return {folha:sum(ps,x=>x.salary/days),inss:sum(ps,x=>(x.salary*(x.inss/100))/days),fgts:sum(ps,x=>(x.salary*(x.fgts/100))/days),fonte:'cadastro'};
 }
 const hist=[...state.daily].filter(x=>x.obra===obra&&x.equipe===equipe&&(x.folha||x.inss||x.fgts)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||Number(b.id||0)-Number(a.id||0))[0];
 return hist ? {folha:Number(hist.folha||0),inss:Number(hist.inss||0),fgts:Number(hist.fgts||0),fonte:'historico'} : {folha:0,inss:0,fgts:0,fonte:'zero'};
}
function renderDashboard(){
 const s=filterStart.value||monthStart(),e=filterEnd.value||isoToday();filterStart.value=s;filterEnd.value=e;
 const data=rangeData(s,e),receita=sum(data,x=>x.receita),custo=sum(data,x=>x.custo),res=receita-custo,margem=receita?res/receita:0;
 kpis.innerHTML=`<div class="kpi"><span>Receita</span><b>${brl(receita)}</b></div><div class="kpi"><span>Custos</span><b>${brl(custo)}</b></div><div class="kpi ${res>=0?'good':'bad'}"><span>Resultado</span><b>${brl(res)}</b></div><div class="kpi ${margem>=0?'good':'bad'}"><span>Margem</span><b>${num(margem*100,1)}%</b></div>`;
 const map={};data.forEach(x=>{const k=x.obra+'|'+x.equipe;if(!map[k])map[k]={obra:x.obra,equipe:x.equipe,prodT:0,prodM2:0,receita:0,custo:0};const m=map[k];if(x.unidade==='m²')m.prodM2+=x.producao;else m.prodT+=x.producao;m.receita+=x.receita;m.custo+=x.custo});
 summaryList.innerHTML=Object.values(map).sort((a,b)=>(b.receita-b.custo)-(a.receita-a.custo)).map(x=>{const r=x.receita-x.custo,mg=x.receita?r/x.receita:0;return `<div class="summary-card"><div class="head"><div><b>${x.obra}</b><div class="meta">${x.equipe}</div></div><div class="money ${r>=0?'good':'bad'}">${brl(r)}</div></div><div class="mini-grid"><div><span>Receita</span><b>${brl(x.receita)}</b></div><div><span>Custo</span><b>${brl(x.custo)}</b></div><div><span>Margem</span><b>${num(mg*100,1)}%</b></div><div><span>Produção t</span><b>${num(x.prodT,2)}</b></div><div><span>Produção m²</span><b>${num(x.prodM2,2)}</b></div></div></div>`}).join('')||'<div class="card">Sem lançamentos no período.</div>'
}
function fillSelect(el,values){const cur=el.value;el.innerHTML=values.map(x=>`<option>${x}</option>`).join('');if(values.includes(cur))el.value=cur}
function validTeamsForObra(obra){
 return [...new Set(state.contracts.filter(c=>c.ativo!==false&&c.obra===obra).map(c=>c.equipe))];
}
function refreshLaunchTeams(){
 const valid=validTeamsForObra(lObra.value);
 const current=lEquipe.value;
 fillSelect(lEquipe,valid);
 if(valid.includes(current))lEquipe.value=current;
 refreshLaunchDefaults();
}
function fillSelects(){
 const obs=state.obras.filter(x=>x.ativa!==false).map(x=>x.nome);
 [lObra,eObra,pObra,fObra].forEach(x=>fillSelect(x,obs));
 if(!lDate.value)lDate.value=isoToday();
 refreshLaunchTeams();
 refreshEquipmentTeams();
 refreshFixedCostTeams(false);
 refreshPeopleTeams();
}
function refreshEquipmentTeams(){
 const valid=validTeamsForObra(eObra.value);
 const cur=eEquipe.value;
 fillSelect(eEquipe,valid);
 if(valid.includes(cur))eEquipe.value=cur;
 previewEquipmentDaily();
}
function refreshPeopleTeams(){
 const valid=validTeamsForObra(pObra.value);
 const cur=pEquipe.value;
 fillSelect(pEquipe,valid);
 if(valid.includes(cur))pEquipe.value=cur;
}
function refreshFixedCostTeams(load=true){
 const valid=validTeamsForObra(fObra.value);
 const cur=fEquipe.value;
 fillSelect(fEquipe,valid);
 if(valid.includes(cur))fEquipe.value=cur;
 if(load)loadFixedCostByCombo();
}
function loadFixedCostByCombo(){
 if(!window.fObra||!window.fEquipe)return;
 const x=state.fixedCosts.find(v=>v.obra===fObra.value&&v.equipe===fEquipe.value);
 editingFixedCostId=x?.id||null;
 fDays.value=x?.diasMes||contractFor(fObra.value,fEquipe.value)?.diasMes||26;
 fPayroll.value=x?.folhaMensal||0;
 fInss.value=x?.inssMensal||0;
 fFgts.value=x?.fgtsMensal||0;
 fixedSaveBtn.textContent=x?'Salvar alterações':'Salvar custos fixos';
 fixedCancelBtn.classList.toggle('hidden',!x);
 previewFixedDaily();
}

function previewEquipmentDaily(){
 if(!window.eMonthly||!window.eDays||!window.equipmentDailyPreview)return;
 const mensal=Number(eMonthly.value||0),dias=Number(eDays.value||26);
 equipmentDailyPreview.innerHTML=`Locação diária calculada: <b>${brl(dias?mensal/dias:0)}</b>`;
}
function previewFixedDaily(){
 if(!window.fixedDailyPreview)return;
 const dias=Number(fDays.value||26);
 const folha=Number(fPayroll.value||0),inss=Number(fInss.value||0),fgts=Number(fFgts.value||0);
 fixedDailyPreview.innerHTML=`<b>Valores diários automáticos</b><div class="daily-preview-grid">
 <span>Folha/dia <strong>${brl(dias?folha/dias:0)}</strong></span>
 <span>INSS/dia <strong>${brl(dias?inss/dias:0)}</strong></span>
 <span>FGTS/dia <strong>${brl(dias?fgts/dias:0)}</strong></span>
 </div>`;
}
function refreshLaunchDefaults(){
 const c=contractFor(lObra.value,lEquipe.value);
 const v=lUnit.value==='m²'?(c?.contratoM2||0):(c?.contratoTon||0);
 lContract.value=v||0;
 previewLaunch();
}
document.addEventListener('input',e=>{
 if(['lProd','lContract','lFuel','lToll','lMaint','lOther'].includes(e.target.id))previewLaunch();
 if(['eMonthly','eDays'].includes(e.target.id))previewEquipmentDaily();
 if(['fDays','fPayroll','fInss','fFgts'].includes(e.target.id))previewFixedDaily();
})
function calcLaunch(){
 const obra=lObra.value,equipe=lEquipe.value,prod=Number(lProd.value||0),contr=Number(lContract.value||0),receita=prod*contr;
 const c=contractFor(obra,equipe)||{},p=peopleDay(obra,equipe),eq=equipDay(obra,equipe),iss=receita*Number(c.issPct||0)/100;
 const fuel=Number(lFuel.value||0),toll=Number(lToll.value||0),maint=Number(lMaint.value||0),other=Number(lOther.value||0);
 const custo=p.folha+p.inss+p.fgts+iss+eq+fuel+toll+maint+other,res=receita-custo,mg=receita?res/receita:0;
 return {receita,folha:p.folha,inss:p.inss,fgts:p.fgts,iss,equipamentos:eq,combustivel:fuel,pedagio:toll,manutencao:maint,outras:other,custo,resultado:res,margem:mg,custoUnidade:prod?custo/prod:0,folhaFonte:p.fonte,contrato:contr}
}
function previewLaunch(){
 if(!window.lObra)return;
 const c=contractFor(lObra.value,lEquipe.value),x=calcLaunch();
 if(!c){
   launchPreview.innerHTML='<div class="auto-warning">⚠️ Esta obra/equipe não possui contrato cadastrado.</div>';
   return;
 }
 const fonte=x.folhaFonte==='mensal'?'Custos mensais ÷ dias/mês':(x.folhaFonte==='historico'?'Último custo diário da planilha':(x.folhaFonte==='cadastro'?'Cadastro de colaboradores':'Sem folha cadastrada'));
 launchPreview.innerHTML=`
 <div class="auto-title">Cálculo automático</div>
 <div class="auto-grid">
  <div><span>Contrato/unidade</span><b>${brl(x.contrato)}</b></div>
  <div><span>Receita</span><b>${brl(x.receita)}</b></div>
  <div><span>Folha bruta/dia</span><b>${brl(x.folha)}</b></div>
  <div><span>INSS/dia</span><b>${brl(x.inss)}</b></div>
  <div><span>FGTS/dia</span><b>${brl(x.fgts)}</b></div>
  <div><span>ISS/dia</span><b>${brl(x.iss)}</b></div>
  <div><span>Equipamentos/dia</span><b>${brl(x.equipamentos)}</b></div>
  <div><span>Combustível</span><b>${brl(x.combustivel)}</b></div>
  <div><span>Pedágio</span><b>${brl(x.pedagio)}</b></div>
  <div><span>Manutenção</span><b>${brl(x.manutencao)}</b></div>
  <div><span>Outras despesas</span><b>${brl(x.outras)}</b></div>
  <div><span>Custo total</span><b>${brl(x.custo)}</b></div>
  <div><span>Resultado</span><b class="${x.resultado>=0?'good':'bad'}">${brl(x.resultado)}</b></div>
  <div><span>Margem</span><b class="${x.margem>=0?'good':'bad'}">${num(x.margem*100,1)}%</b></div>
  <div><span>Custo/unidade</span><b>${brl(x.custoUnidade)}</b></div>
 </div>
 <div class="auto-source">Folha: ${fonte}</div>`;
}
async function saveLaunch(){
 const contrato=contractFor(lObra.value,lEquipe.value);
 if(!contrato)return alert('Cadastre o contrato desta obra/equipe antes de lançar.');
 if(Number(lProd.value||0)>0 && Number(lContract.value||0)<=0)return alert('O contrato por unidade está zerado. Confira o cadastro antes de salvar.');
 const x=calcLaunch(),obra=state.obras.find(o=>o.nome===lObra.value),equipe=state.equipes.find(e=>e.nome===lEquipe.value);
 const payload={data:lDate.value,obra_id:obra.id,equipe_id:equipe.id,producao:Number(lProd.value||0),unidade:lUnit.value,contrato_unidade:Number(lContract.value||0),receita:x.receita,folha_bruta_dia:x.folha,inss_dia:x.inss,fgts_dia:x.fgts,iss_dia:x.iss,locacao_equipamentos_dia:x.equipamentos,combustivel:Number(lFuel.value||0),pedagio:Number(lToll.value||0),manutencao:Number(lMaint.value||0),outras_despesas:Number(lOther.value||0),custo_total:x.custo,lucro_prejuizo:x.resultado,margem:x.margem,custo_unidade:x.custoUnidade,alerta:x.resultado<0?'ALERTA: PREJUÍZO':'LUCRO',origem:'app'};
 let q=editingLaunchId ? sb.from('lancamentos_diarios').update(payload).eq('id',editingLaunchId) : sb.from('lancamentos_diarios').insert(payload);
 const {error}=await q;
 if(error){alert('Erro ao salvar: '+error.message);return}
 const wasEdit=!!editingLaunchId;
 cancelLaunchEdit(false);
 await loadCloud();
 alert(wasEdit?'Lançamento atualizado na nuvem.':'Lançamento salvo na nuvem.');
}
function editLaunch(id){
 const x=state.daily.find(r=>Number(r.id)===Number(id)); if(!x)return;
 editingLaunchId=x.id;
 go('launch');
 lDate.value=x.date;
 lObra.value=x.obra; refreshLaunchTeams();
 lEquipe.value=x.equipe; lUnit.value=x.unidade; refreshLaunchDefaults();
 lProd.value=x.producao;
 lFuel.value=x.combustivel||0; lToll.value=x.pedagio||0; lMaint.value=x.manutencao||0; lOther.value=x.outras||0;
 saveLaunchBtn.textContent='Salvar alterações';
 cancelEditBtn.classList.remove('hidden');
 previewLaunch();
 scrollTo(0,0);
}
function cancelLaunchEdit(clear=true){
 editingLaunchId=null;
 if(window.saveLaunchBtn)saveLaunchBtn.textContent='Salvar lançamento';
 if(window.cancelEditBtn)cancelEditBtn.classList.add('hidden');
 if(clear && window.lProd){
   lProd.value=0;lFuel.value=0;lToll.value=0;lMaint.value=0;lOther.value=0;
   lDate.value=isoToday();refreshLaunchDefaults();
 }
}
async function deleteLaunch(id){
 const x=state.daily.find(r=>Number(r.id)===Number(id)); if(!x)return;
 if(!confirm(`Excluir definitivamente o lançamento de ${x.date.split('-').reverse().join('/')} · ${x.obra} · ${x.equipe}?`))return;
 const {error}=await sb.from('lancamentos_diarios').delete().eq('id',id);
 if(error)return alert('Erro ao excluir: '+error.message);
 if(Number(editingLaunchId)===Number(id))cancelLaunchEdit();
 await loadCloud();
 alert('Lançamento excluído.');
}
function renderLaunches(){
 const q=(launchSearch.value||'').toLowerCase(),list=[...state.daily].reverse().filter(x=>(x.obra+' '+x.equipe).toLowerCase().includes(q)).slice(0,100);
 launchList.innerHTML=list.map(x=>`<div class="list-card launch-card">
 <div class="head"><div><b>${x.obra} · ${x.equipe}</b><div class="meta">${x.date.split('-').reverse().join('/')} · ${num(x.producao,3)} ${x.unidade}</div></div><div class="money ${x.resultado>=0?'good':'bad'}">${brl(x.resultado)}</div></div>
 <div class="mini-grid"><div><span>Receita</span><b>${brl(x.receita)}</b></div><div><span>Custo total</span><b>${brl(x.custo)}</b></div><div><span>Margem</span><b>${num(x.margem*100,1)}%</b></div><div><span>Custo/unidade</span><b>${brl(x.custoUnidade)}</b></div></div>
 <details><summary>Ver composição dos custos</summary>
  <div class="cost-lines">
   <div><span>Folha bruta/dia</span><b>${brl(x.folha)}</b></div>
   <div><span>INSS/dia</span><b>${brl(x.inss)}</b></div>
   <div><span>FGTS/dia</span><b>${brl(x.fgts)}</b></div>
   <div><span>ISS/dia</span><b>${brl(x.iss)}</b></div>
   <div><span>Locação equipamentos/dia</span><b>${brl(x.equipamentos)}</b></div>
   <div><span>Combustível</span><b>${brl(x.combustivel)}</b></div>
   <div><span>Pedágio</span><b>${brl(x.pedagio)}</b></div>
   <div><span>Manutenção</span><b>${brl(x.manutencao)}</b></div>
   <div><span>Outras despesas</span><b>${brl(x.outras)}</b></div>
  </div>
 </details>
 <div class="row-actions"><button onclick="editLaunch(${x.id})">Editar</button><button class="danger" onclick="deleteLaunch(${x.id})">Excluir</button></div>
 </div>`).join('')
}
function regTab(name,btn){document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.regpane').forEach(x=>x.classList.remove('active'));document.getElementById('reg'+name[0].toUpperCase()+name.slice(1)).classList.add('active')}
function renderRegisters(){
 fillSelects();
 contractList.innerHTML=state.contracts.map(x=>`<div class="list-card"><div class="head"><div><b>${x.obra}</b><div class="meta">${x.equipe} · ${x.diasMes} dias/mês</div></div><div class="row-actions compact"><button onclick="editContract(${x.id})">Editar</button><button class="danger" onclick="delContract(${x.id})">Excluir</button></div></div><div class="mini-grid"><div><span>R$/t</span><b>${brl(x.contratoTon)}</b></div><div><span>R$/m²</span><b>${brl(x.contratoM2)}</b></div><div><span>ISS</span><b>${num(x.issPct,2)}%</b></div></div></div>`).join('');
 equipmentList.innerHTML=state.equipments.map(x=>`<div class="list-card"><div class="head"><div><b>${x.descricao}</b><div class="meta">${x.obra} · ${x.equipe}</div></div><span class="status-pill ${x.ativo?'on':'off'}">${x.ativo?'Ativo':'Inativo'}</span></div><div class="mini-grid"><div><span>Mensal</span><b>${brl(x.mensal)}</b></div><div><span>Por dia</span><b>${brl(x.mensal/(x.diasMes||26))}</b></div><div><span>Dias/mês</span><b>${x.diasMes}</b></div></div><div class="row-actions compact"><button onclick="editEquipment(${x.id})">Editar</button><button onclick="toggleEquipment(${x.id},${!x.ativo})">${x.ativo?'Desativar':'Ativar'}</button><button class="danger" onclick="delEquipment(${x.id})">Excluir</button></div></div>`).join('');
 fixedCostList.innerHTML=state.fixedCosts.map(x=>`<div class="list-card"><div class="head"><div><b>${x.obra} · ${x.equipe}</b><div class="meta">${x.diasMes} dias/mês</div></div></div><div class="mini-grid"><div><span>Folha mensal</span><b>${brl(x.folhaMensal)}</b></div><div><span>Folha/dia</span><b>${brl(x.folhaMensal/x.diasMes)}</b></div><div><span>INSS mensal</span><b>${brl(x.inssMensal)}</b></div><div><span>INSS/dia</span><b>${brl(x.inssMensal/x.diasMes)}</b></div><div><span>FGTS mensal</span><b>${brl(x.fgtsMensal)}</b></div><div><span>FGTS/dia</span><b>${brl(x.fgtsMensal/x.diasMes)}</b></div></div><button class="small-btn" onclick="loadFixedCost(${x.id})">Editar valores</button></div>`).join('')||'<div class="card">Nenhum custo fixo cadastrado.</div>';
 peopleList.innerHTML=state.collaborators.map(x=>`<div class="list-card"><div class="head"><div><b>${x.name}</b><div class="meta">${x.obra} · ${x.equipe}</div></div><button onclick="delPerson(${x.id})">Excluir</button></div><div class="meta">Salário ${brl(x.salary)} · INSS ${num(x.inss,2)}% · FGTS ${num(x.fgts,2)}%</div></div>`).join('')||'<div class="card">Nenhum colaborador cadastrado ainda.</div>';
 previewEquipmentDaily();
 loadFixedCostByCombo();
}
async function addContract(){
 let obra=state.obras.find(x=>x.nome===cObra.value.trim()),equipe=state.equipes.find(x=>x.nome===cEquipe.value.trim());
 if(!cObra.value.trim()||!cEquipe.value.trim())return alert('Informe obra e equipe.');
 if(!obra){let r=await sb.from('obras').insert({nome:cObra.value.trim()}).select().single();if(r.error)return alert(r.error.message);obra=r.data}
 if(!equipe){let r=await sb.from('equipes').insert({nome:cEquipe.value.trim()}).select().single();if(r.error)return alert(r.error.message);equipe=r.data}
 const payload={obra_id:obra.id,equipe_id:equipe.id,dias_trabalhados_mes:Number(cDias.value||26),iss_pct:Number(cIss.value||0),contrato_tonelada:Number(cTon.value||0),contrato_m2:Number(cM2.value||0),ativo:true};
 let q=editingContractId?sb.from('contratos_obra_equipe').update(payload).eq('id',editingContractId):sb.from('contratos_obra_equipe').upsert(payload,{onConflict:'obra_id,equipe_id'});
 const {error}=await q;
 if(error)return alert(error.message);
 cancelContractEdit(false);await loadCloud();alert('Contrato salvo.');
}
function editContract(id){
 const x=state.contracts.find(v=>Number(v.id)===Number(id));if(!x)return;
 editingContractId=x.id;cObra.value=x.obra;cEquipe.value=x.equipe;cDias.value=x.diasMes;cIss.value=x.issPct;cTon.value=x.contratoTon;cM2.value=x.contratoM2;
 contractFormTitle.textContent='Editar contrato';contractSaveBtn.textContent='Salvar alterações';contractCancelBtn.classList.remove('hidden');scrollTo(0,0);
}
function cancelContractEdit(clear=true){
 editingContractId=null;contractFormTitle.textContent='Obra, equipe e contrato';contractSaveBtn.textContent='Salvar contrato';contractCancelBtn.classList.add('hidden');
 if(clear){cObra.value='';cEquipe.value='';cDias.value=26;cIss.value=0;cTon.value=0;cM2.value=0}
}
async function addEquipment(){
 const obra=state.obras.find(x=>x.nome===eObra.value),equipe=state.equipes.find(x=>x.nome===eEquipe.value);
 if(!eDesc.value.trim())return alert('Informe a descrição do equipamento.');
 const mensal=Number(eMonthly.value||0),dias=Number(eDays.value||26);
 const payload={descricao:eDesc.value.trim(),obra_id:obra?.id||null,equipe_id:equipe?.id||null,locacao_mensal:mensal,dias_mes:dias,locacao_dia:dias?mensal/dias:0,ativo:true};
 let q=editingEquipmentId?sb.from('equipamentos').update(payload).eq('id',editingEquipmentId):sb.from('equipamentos').insert(payload);
 const {error}=await q;
 if(error)return alert(error.message);
 cancelEquipmentEdit(false);await loadCloud();alert('Equipamento salvo.');
}
function editEquipment(id){
 const x=state.equipments.find(v=>Number(v.id)===Number(id));if(!x)return;
 editingEquipmentId=x.id;eDesc.value=x.descricao;eObra.value=x.obra;refreshEquipmentTeams();eEquipe.value=x.equipe;eMonthly.value=x.mensal;eDays.value=x.diasMes;
 equipmentFormTitle.textContent='Editar equipamento';equipmentSaveBtn.textContent='Salvar alterações';equipmentCancelBtn.classList.remove('hidden');previewEquipmentDaily();scrollTo(0,0);
}
function cancelEquipmentEdit(clear=true){
 editingEquipmentId=null;equipmentFormTitle.textContent='Equipamento';equipmentSaveBtn.textContent='Salvar equipamento';equipmentCancelBtn.classList.add('hidden');
 if(clear){eDesc.value='';eMonthly.value=0;eDays.value=26} previewEquipmentDaily();
}
async function toggleEquipment(id,value){
 const {error}=await sb.from('equipamentos').update({ativo:value}).eq('id',id);if(error)return alert(error.message);await loadCloud();
}
function loadFixedCost(id){
 const x=state.fixedCosts.find(v=>Number(v.id)===Number(id));if(!x)return;
 editingFixedCostId=x.id;fObra.value=x.obra;refreshFixedCostTeams(false);fEquipe.value=x.equipe;fDays.value=x.diasMes;fPayroll.value=x.folhaMensal;fInss.value=x.inssMensal;fFgts.value=x.fgtsMensal;
 fixedSaveBtn.textContent='Salvar alterações';fixedCancelBtn.classList.remove('hidden');previewFixedDaily();scrollTo(0,0);
}
function cancelFixedCostEdit(clear=true){
 editingFixedCostId=null;fixedSaveBtn.textContent='Salvar custos fixos';fixedCancelBtn.classList.add('hidden');
 if(clear){fDays.value=26;fPayroll.value=0;fInss.value=0;fFgts.value=0} previewFixedDaily();
}
async function saveFixedCost(){
 const obra=state.obras.find(x=>x.nome===fObra.value),equipe=state.equipes.find(x=>x.nome===fEquipe.value);
 if(!obra||!equipe)return alert('Selecione obra e equipe.');
 const payload={obra_id:obra.id,equipe_id:equipe.id,dias_mes:Number(fDays.value||26),folha_mensal:Number(fPayroll.value||0),inss_mensal:Number(fInss.value||0),fgts_mensal:Number(fFgts.value||0),ativo:true};
 let q=editingFixedCostId?sb.from('custos_fixos_equipe').update(payload).eq('id',editingFixedCostId):sb.from('custos_fixos_equipe').upsert(payload,{onConflict:'obra_id,equipe_id'});
 const {error}=await q;
 if(error)return alert(error.message);
 cancelFixedCostEdit(false);await loadCloud();alert('Custos fixos atualizados.');
}
async function addPerson(){
 const obra=state.obras.find(x=>x.nome===pObra.value),equipe=state.equipes.find(x=>x.nome===pEquipe.value);
 const {error}=await sb.from('colaboradores').insert({nome:pName.value.trim(),obra_id:obra?.id||null,equipe_id:equipe?.id||null,salario_mensal:Number(pSalary.value||0),inss_pct:Number(pInss.value||0),fgts_pct:Number(pFgts.value||0),ativo:true});
 if(error)return alert(error.message);await loadCloud();
}
async function delContract(id){if(!confirm('Excluir contrato?'))return;if(Number(editingContractId)===Number(id))cancelContractEdit();const {error}=await sb.from('contratos_obra_equipe').delete().eq('id',id);if(error)return alert(error.message);await loadCloud()}
async function delEquipment(id){if(!confirm('Excluir equipamento?'))return;if(Number(editingEquipmentId)===Number(id))cancelEquipmentEdit();const {error}=await sb.from('equipamentos').delete().eq('id',id);if(error)return alert(error.message);await loadCloud()}
async function delPerson(id){if(!confirm('Excluir colaborador?'))return;const {error}=await sb.from('colaboradores').delete().eq('id',id);if(error)return alert(error.message);await loadCloud()}
function dreRow(a,b,cls=''){return `<div class="dre-row ${cls}"><span>${a}</span><b>${b}</b></div>`}
function renderDRE(){
 const s=dreStart.value||monthStart(),e=dreEnd.value||isoToday();dreStart.value=s;dreEnd.value=e;const d=rangeData(s,e);
 const receita=sum(d,x=>x.receita),folha=sum(d,x=>x.folha),inss=sum(d,x=>x.inss),fgts=sum(d,x=>x.fgts),iss=sum(d,x=>x.iss),equip=sum(d,x=>x.equipamentos),fuel=sum(d,x=>x.combustivel),toll=sum(d,x=>x.pedagio),maint=sum(d,x=>x.manutencao),other=sum(d,x=>x.outras),cost=folha+inss+fgts+iss+equip+fuel+toll+maint+other,res=receita-cost,mg=receita?res/receita:0,pt=sum(d.filter(x=>x.unidade!=='m²'),x=>x.producao),pm=sum(d.filter(x=>x.unidade==='m²'),x=>x.producao);
 dreContent.innerHTML=`<div class="card">${dreRow('Produção em toneladas',num(pt,3)+' t')}${dreRow('Produção em m²',num(pm,2)+' m²')}${dreRow('Receita da produção',brl(receita),'total')}</div><div class="card">${dreRow('Folha bruta',brl(folha))}${dreRow('INSS',brl(inss))}${dreRow('FGTS',brl(fgts))}${dreRow('ISS',brl(iss))}${dreRow('Locação de equipamentos',brl(equip))}${dreRow('Combustível',brl(fuel))}${dreRow('Pedágio',brl(toll))}${dreRow('Manutenção',brl(maint))}${dreRow('Outras despesas',brl(other))}${dreRow('TOTAL DE CUSTOS',brl(cost),'total')}</div><div class="card">${dreRow('Lucro / prejuízo',brl(res),'total')}${dreRow('Margem',num(mg*100,2)+'%')}<div class="dre-status ${res>=0?'good':'bad'}">${res>=0?'LUCRO NO PERÍODO':'ALERTA: PREJUÍZO NO PERÍODO'}</div></div>`
}
function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup-controle-obras.json';a.click();URL.revokeObjectURL(a.href)}

boot();