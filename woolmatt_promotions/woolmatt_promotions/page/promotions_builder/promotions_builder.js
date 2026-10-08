
frappe.pages['promotions-builder'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Promotions Builder',
		single_column: true
	});

	// Append our HTML
	$(frappe.render_template("promotions_builder", {})).appendTo(page.main);

	// JS logic

const typeName=id=>(TYPES.find(t=>t.id===id)||{}).name||id;
let PROMOS=[
 {id:1,name:'Abony Cheese Weekend Saver',desc:'20% off Abony cheese',type:'pct',funding:'supplier',status:'active',products:8,start:'2026-08-08',end:'2026-08-11',supplier:'Abony Dairies Limited',sold:412,disc:18540,rebate:18540,self:0,baseline:260},
 {id:2,name:'Adix Homeware Price Cut',desc:'KES 50 off Adix plasticware',type:'price',funding:'self',status:'active',products:37,start:'2026-08-01',end:'2026-08-15',supplier:'-',sold:196,disc:11270,rebate:0,self:11270,baseline:150},
 {id:3,name:'Aquamist Happy Hour',desc:'20% off water 4-7pm daily',type:'happy',funding:'both',status:'active',products:14,start:'2026-08-05',end:'2026-08-31',supplier:'Aquamist Limited',sold:640,disc:9600,rebate:5760,self:3840,baseline:400},
 {id:4,name:'Fanaka Flour BOGO',desc:'Buy 1 get 1 free - Fanaka 1kg',type:'bogo',funding:'supplier',status:'scheduled',products:15,start:'2026-08-18',end:'2026-08-25',supplier:'Agri Pro-Pak Ltd',sold:0,disc:0,rebate:0,self:0,baseline:180},
 {id:5,name:'Back-to-School Combo',desc:'Buy a main, add-ons up to 25% off',type:'combo',funding:'self',status:'ended',products:12,start:'2026-07-10',end:'2026-07-31',supplier:'-',sold:1180,disc:47200,rebate:0,self:47200,baseline:300},
 {id:6,name:'Double Points - Armco',desc:'2x points on Armco cookware',type:'points',funding:'self',status:'ended',products:19,start:'2026-07-01',end:'2026-07-15',supplier:'-',sold:88,disc:0,rebate:0,self:4400,baseline:70},
];
let filter='all',reportId=null;
function showView(v){document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));$('v-'+v).classList.add('on');document.querySelectorAll('.tbnav button').forEach(b=>b.classList.remove('on'));if(v==='dashboard'){$('nav-dashboard').classList.add('on');renderDashboard();}if(v==='builder')$('nav-builder').classList.add('on');window.scrollTo(0,0);}
function setFilter(f,btn){filter=f;document.querySelectorAll('.filters button').forEach(b=>b.classList.remove('on'));btn.classList.add('on');renderList();}
function renderDashboard(){const active=PROMOS.filter(p=>p.status==='active').length,sched=PROMOS.filter(p=>p.status==='scheduled').length;
  $('kActive').textContent=active;$('kSched').textContent=sched+' scheduled';
  $('kDisc').textContent=money(PROMOS.reduce((s,p)=>s+p.disc,0));
  $('kRebate').textContent=money(PROMOS.filter(p=>p.status!=='ended').reduce((s,p)=>s+p.rebate,0));
  $('kSelf').textContent=money(PROMOS.reduce((s,p)=>s+p.self,0));renderList();}
function statusBadge(s){return s==='active'?'<span class="dotstat active"><span class="d"></span>Active</span>':s==='scheduled'?'<span class="dotstat sched"><span class="d"></span>Scheduled</span>':'<span class="dotstat ended"><span class="d"></span>Ended</span>';}
function fundBadge(f){return f==='self'?'<span class="badge b-self">Self funded</span>':f==='supplier'?'<span class="badge b-supplier">Supplier funded</span>':'<span class="badge b-both">Co-funded</span>';}
function renderList(){let list=PROMOS.slice();if(filter!=='all')list=list.filter(p=>p.status===filter);
  $('promoList').innerHTML=list.map(p=>{const up=p.baseline>0&&p.sold>0?Math.round((p.sold-p.baseline)/p.baseline*100):null;
    return '<div class="pcard"><div class="pmain"><div class="ptop"><span class="pname">'+p.name+'</span><span class="badge b-type">'+typeName(p.type)+'</span>'+fundBadge(p.funding)+'</div><div class="pdesc">🎁 '+p.desc+'</div><div class="pmeta"><span><b>'+p.products+'</b> products</span><span>'+p.start+' → '+p.end+'</span>'+(p.sold>0?'<span>Sold <b>'+p.sold.toLocaleString()+'</b></span><span>Discount <b>'+money(p.disc)+'</b></span>'+(up!==null?'<span>Uplift <b style="color:'+(up>=0?'#2E7D32':'#C0392B')+'">'+(up>=0?'+':'')+up+'%</b></span>':''):'<span style="color:#9AA79E">Not started</span>')+'</div></div><div class="pright">'+statusBadge(p.status)+'<div class="pactions"><button class="btn outline sm" onclick="openReport('+p.id+')">📊 Report</button>'+(p.status!=='ended'?'<button class="btn outline sm" onclick="reportId='+p.id+';extendPromo()">⏱ Extend</button>':'')+'</div></div></div>';}).join('')||'<div class="emptyp">No promotions in this filter.</div>';}

function newPromo(){promo={type:'pct',products:[]};
  $('builderTitle').textContent='New promotion';$('bName').value='';$('bPosDesc').value='';$('bPriority').value='10';
  const today=new Date().toISOString().slice(0,10);$('bStart').value=today;$('bEnd').value=today;
  HH_SLOTS=[];buildTypeGrid();$('typeConfig').innerHTML=typeConfigHTML('pct');
  onScopeBy();
  $('bulkBox').value='';$('bulkResult').innerHTML='';$('bulkVal').value='';$('bulkFund').value='';
  renderProducts();syncScheduleTimes();updatePosPreview();showView('builder');}
function savePromo(){const name=($('bName').value||'').trim();if(!name){alert('Give the promotion a name.');return;}if(!promo.products.length){alert('Add at least one product.');return;}
  const funds=[...new Set(promo.products.map(p=>p.fund||'supplier'))];const funding=funds.length===1?funds[0]:'both';
  let tReg=0,tOff=0,tW=0,tS=0;const isDisc=(promo.type==="pct"||promo.type==="happy"||promo.type==="price");promo.products.forEach(p=>{tReg+=p.price;if(isDisc){const c=rowCalc(p);tOff+=c.offer;tW+=c.wKes;tS+=c.sKes;}});
  const sup=[...new Set(promo.products.map(p=>p.supplier))];const id=Math.max(...PROMOS.map(p=>p.id))+1;
  PROMOS.unshift({id,name,desc:($('bPosDesc').value||name),type:promo.type,funding,status:'scheduled',products:promo.products.length,start:$('bStart').value,end:$('bEnd').value,supplier:(sup.length===1?sup[0]:sup.length+' suppliers'),sold:0,disc:0,rebate:0,self:0,baseline:0,plannedDisc:Math.round(tReg-tOff),plannedSelf:Math.round(tW),plannedSup:Math.round(tS)});
  showView('dashboard');}

function kpi(l,v,d,cls){return '<div class="kpi '+(cls||'')+'"><div class="kl">'+l+'</div><div class="kv num">'+v+'</div><div class="kd">'+d+'</div></div>';}
function openReport(id){reportId=id;const p=PROMOS.find(x=>x.id===id);if(!p)return;
  $('repTitle').textContent=p.name;
  $('repMeta').innerHTML='<div class="pcard" style="grid-template-columns:1fr"><div class="ptop"><span class="badge b-type">'+typeName(p.type)+'</span>'+fundBadge(p.funding)+statusBadge(p.status)+'</div><div class="pdesc">🎁 '+p.desc+'</div><div class="pmeta"><span>'+p.start+' → '+p.end+'</span><span><b>'+p.products+'</b> products</span>'+(p.supplier!=='-'?'<span>Supplier <b>'+p.supplier+'</b></span>':'')+'</div></div>';
  const up=p.baseline>0?Math.round((p.sold-p.baseline)/p.baseline*100):0;
  $('repKpis').innerHTML=kpi('Units sold',p.sold.toLocaleString(),'during promo period')+kpi('Total discount',money(p.disc),'value given to shoppers','accent')+kpi('Supplier rebate',money(p.rebate),'recoverable','gold')+kpi('Self-funded cost',money(p.self),'our investment');
  const days=7,base=p.baseline,peak=p.sold/days;let bars='';
  for(let i=0;i<days;i++){const pv=peak*(0.7+Math.random()*0.6),bv=base/days;const hP=Math.min(100,pv/(peak*1.3||1)*100),hB=Math.min(100,bv/(peak*1.3||1)*100);bars+='<div class="bar"><div style="width:100%;display:flex;gap:3px;align-items:flex-end;height:100%"><div class="bcol" style="height:'+hB+'%;background:#CBD5C8"></div><div class="bcol" style="height:'+hP+'%"></div></div><div class="blab">D'+(i+1)+'</div></div>';}
  $('repBars').innerHTML=bars;$('repRange').textContent='Uplift vs baseline: '+(up>=0?'+':'')+up+'%';
  const sample=PRODUCTS.slice(0,Math.min(6,p.products||3));let rows='',tS=0,tD=0,tR=0,tF=0;
  sample.forEach(pr=>{const units=Math.round(p.sold/sample.length*(0.8+Math.random()*0.5));const dpu=p.sold?Math.round(p.disc/p.sold):0;const td=units*dpu,reb=Math.round(td*(p.rebate/(p.disc||1))),self=td-reb;tS+=units;tD+=td;tR+=reb;tF+=self;rows+='<tr><td><b>'+pr.name+'</b></td><td style="text-align:right" class="num">'+units.toLocaleString()+'</td><td style="text-align:right" class="num">'+money(dpu)+'</td><td style="text-align:right" class="num">'+money(td)+'</td><td style="text-align:right" class="num">'+money(reb)+'</td><td style="text-align:right" class="num">'+money(self)+'</td></tr>';});
  $('repBody').innerHTML=rows;$('repFoot').innerHTML='<tr style="font-weight:800;border-top:2px solid var(--line)"><td>Total</td><td style="text-align:right" class="num">'+tS.toLocaleString()+'</td><td></td><td style="text-align:right" class="num">'+money(tD)+'</td><td style="text-align:right;color:var(--orange)" class="num">'+money(tR)+'</td><td style="text-align:right;color:var(--purple)" class="num">'+money(tF)+'</td></tr>';
  showView('report');}
function extendPromo(){const p=PROMOS.find(x=>x.id===reportId);if(!p){alert('Open a report first.');return;}$('extDate').value=p.end;$('extendOverlay').style.display='flex';}
function confirmExtend(){const p=PROMOS.find(x=>x.id===reportId);if(p){p.end=$('extDate').value;if(p.status==='ended')p.status='active';}$('extendOverlay').style.display='none';renderDashboard();}

document.addEventListener('click',e=>{if(!e.target.closest('.searchwrap'))$('prodDrop').classList.remove('show');});
initData();buildTypeGrid();renderDashboard();

    

    // OVERRIDES FOR ERPNEXT INTEGRATION
    window.savePromo = function() {
        const name = ($('bName').value || '').trim();
        if(!name){ alert('Give the promotion a name.'); return; }
        
        let payload = {
            name: name,
            priority: $('bPriority').value,
            pos_desc: $('bPosDesc').value,
            type: promo.type,
            start: $('bStart').value,
            end: $('bEnd').value,
            products: promo.products
        };
        
        if (promo.type === 'happy') {
            payload.hh_slots = HH_SLOTS;
        }
        
        frappe.call({
            method: "woolmatt_promotions.woolmatt_promotions.api.save_promotion",
            args: { payload: JSON.stringify(payload) },
            callback: function(r) {
                if (r.message && r.message.status === "success") {
                    frappe.msgprint("Promotion saved successfully!");
                    showView('dashboard');
                } else {
                    frappe.msgprint("Error saving promotion: " + (r.message ? r.message.message : ""));
                }
            }
        });
    };

    window.addScope = function() {
        let by = $('scopeBy').value;
        let val = $('scopeVal').value;
        frappe.call({
            method: "woolmatt_promotions.woolmatt_promotions.api.search_products",
            args: { scope_by: by, scope_val: val },
            callback: function(r) {
                if(r.message) {
                    let items = r.message;
                    items.forEach(p => {
                        if(!promo.products.find(x => x.id === p.id)) {
                            promo.products.push(newRow(p));
                        }
                    });
                    renderProducts();
                    updateScopeSummary(items.length);
                }
            }
        });
    };

    window.prodSearchInput = frappe.utils.debounce(function() {
        let v = $('prodSearch').value.toLowerCase().trim();
        let drop = $('prodDrop');
        if(!v) { drop.style.display='none'; return; }
        
        frappe.call({
            method: "woolmatt_promotions.woolmatt_promotions.api.search_products",
            args: { term: v },
            callback: function(r) {
                if(r.message) {
                    let html = r.message.map(p => 
                        `<div class="sdrow" onclick="addProd('${p.id}')"><div><b>${p.name}</b> <small>KES ${p.price}</small></div><small>${p.brand} · ${p.supplier}</small></div>`
                    ).join('');
                    
                    // Temp store the results so addProd can find them
                    window.__TEMP_SEARCH_RES = r.message;
                    
                    drop.innerHTML = html || '<div class="emptyp">No matching items</div>';
                    drop.style.display = 'block';
                }
            }
        });
    }, 300);

    window.addProd = function(id) {
        let p = (window.__TEMP_SEARCH_RES || []).find(x => x.id == id) || window.__PRODUCTS__.find(x => x.id == id);
        if(p && !promo.products.find(x => x.id == id)) {
            promo.products.push(newRow(p));
            renderProducts();
        }
        $('prodSearch').value = '';
        $('prodDrop').style.display = 'none';
    };

    // Replace the dashboard rendering to use API KPIs
    frappe.call({
        method: "woolmatt_promotions.woolmatt_promotions.api.get_kpis",
        callback: function(r) {
            if(r.message) {
                if($('kActive')) $('kActive').innerText = r.message.active_promos;
                if($('kSched')) $('kSched').innerText = r.message.scheduled_promos + " scheduled";
                if($('kRebate')) $('kRebate').innerText = "KES " + r.message.rebate_due.toLocaleString();
            }
        }
    });


    // Inject custom Frappe logic overrides here
    // Example: Override initData() to fetch from API
    window.initData = function() {
        frappe.call({
            method: "woolmatt_promotions.woolmatt_promotions.api.get_scopes",
            callback: function(r) {
                if (r.message) {
                    BRANDS = r.message.brands;
                    MFRS = r.message.mfrs;
                    SUPPLIERS = r.message.suppliers;
                }
            }
        });
    };
}
