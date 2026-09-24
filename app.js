const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
let properties=JSON.parse(localStorage.getItem("captalar_properties")||"[]");
let draft={photos:[],signature:null};
let deferredPrompt=null;

const SUPABASE_URL = "https://emvmzkenynkqqmzrqxqi.supabase.co";
const SUPABASE_KEY = "sb_publishable_2VCIY9lN322gBZuh3fu9Eg_hNUmvTA7";

async function supabaseRequest(path, options={}) {
  const response = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Erro no Supabase");
  }

  return response.status === 204 ? null : response.json();
}

async function carregarDoSupabase() {
  try {
    const rows = await supabaseRequest(
      "/rest/v1/properties?select=id,data,created_at&order=created_at.desc"
    );

    const locais = properties || [];
    const mapa = new Map();

    locais.forEach(p => {
      if (p?.id) mapa.set(p.id, p);
    });

    rows.forEach(row => {
      if (row?.data?.id) {
        mapa.set(row.data.id, row.data);
      }
    });

    properties = Array.from(mapa.values());

    properties.sort((a,b) =>
      String(b.created || "").localeCompare(String(a.created || ""))
    );

    localStorage.setItem(
      "captalar_properties",
      JSON.stringify(properties)
    );

    refresh();

    toast(`${properties.length} imóveis sincronizados.`);
  } catch (erro) {
    console.error("Erro ao carregar imóveis do Supabase:", erro);
    toast("Não foi possível sincronizar com o Supabase.");
  }
}

async function salvarNoSupabase(imovel) {
  await supabaseRequest("/rest/v1/properties?on_conflict=id", {
    method: "POST",
    headers: {
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: imovel.id,
      data: imovel
    })
  });
}
function go(id){$$(".screen").forEach(x=>x.classList.remove("active"));$("#"+id).classList.add("active");window.scrollTo(0,0);refresh()}
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
function toast(t){let x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2500)}
function money(v){return v?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(String(v).replace(",","."))):"Não informado"}
function idFor(){return "000"+String(Date.now()).slice(-3)}

$("#geoBtn").onclick=()=>{
 if(!navigator.geolocation){toast("GPS não disponível neste navegador.");return}
 $("#geoStatus").textContent="Obtendo localização…";
 navigator.geolocation.getCurrentPosition(async p=>{
   const lat=p.coords.latitude.toFixed(6),lon=p.coords.longitude.toFixed(6);
   $("#geoStatus").textContent=`GPS: ${lat}, ${lon}. Confirme o endereço abaixo.`;
   try{
     const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=pt-BR`);
     const d=await r.json(),a=d.address||{};
     $("#address").value=a.road||a.pedestrian||"";
     $("#number").value=a.house_number||"";
     $("#neighborhood").value=a.suburb||a.neighbourhood||a.city_district||"";
     $("#city").value=(a.city||a.town||a.municipality||"")+" - "+(a.state||"SP");
     $("#cep").value=a.postcode||"";
     toast("Endereço encontrado. Confira antes de salvar.");
   }catch(e){toast("GPS obtido. Preencha/confirme o endereço.")}
   draft.lat=lat;draft.lon=lon;
 },()=>{$("#geoStatus").textContent="Não foi possível obter o GPS. Verifique a permissão do navegador.";});
};

$("#propertyForm").onsubmit=e=>{
 e.preventDefault();
 draft={...draft,id:idFor(),address:$("#address").value,number:$("#number").value,neighborhood:$("#neighborhood").value,city:$("#city").value,cep:$("#cep").value,type:$("#type").value,price:$("#price").value,rooms:$("#rooms").value,baths:$("#baths").value,parking:$("#parking").value,area:$("#area").value,description:$("#description").value,owner:$("#owner").value,phone:$("#phone").value,whatsapp:$("#whatsapp").value,email:$("#email").value,status:"Enviado",created:new Date().toISOString(),photos:[]};
 $("#photoGrid").innerHTML=""; $("#photoInput").value=""; go("photos");
};

$("#cameraBtn").onclick=()=>$("#photoInput").click();
$("#photoInput").onchange=e=>{
 [...e.target.files].forEach(file=>{
   const r=new FileReader();r.onload=ev=>{
     const img=new Image();img.onload=()=>{
       const c=document.createElement("canvas"),max=1200,s=Math.min(1,max/img.width);
       c.width=img.width*s;c.height=img.height*s;const ctx=c.getContext("2d");ctx.drawImage(img,0,0,c.width,c.height);
       ctx.fillStyle="rgba(8,38,70,.78)";ctx.fillRect(0,c.height-52,c.width,52);
       ctx.fillStyle="#fff";ctx.font="bold 20px Arial";ctx.fillText("CAPTALAR",16,c.height-28);
       ctx.font="bold 15px Arial";ctx.fillText("ID: "+draft.id,150,c.height-29);
       draft.photos.push(c.toDataURL("image/jpeg",.78));
       renderPhotos();
     };img.src=ev.target.result;
   };r.readAsDataURL(file);
 });
};
function renderPhotos(){$("#photoGrid").innerHTML=draft.photos.map(p=>`<img src="${p}" alt="Foto do imóvel">`).join("")||'<div class="hint">Nenhuma foto adicionada.</div>'}
$("#toSignature").onclick=()=>{if(!draft.photos.length){toast("Adicione pelo menos uma foto.");return}go(""signatureScreen")};

// assinatura com mouse/toque
const canvas=$("#signature"),ctx=canvas.getContext("2d");let drawing=false,last=null;
function pos(e){const r=canvas.getBoundingClientRect(),t=e.touches?.[0]||e;return{x:(t.clientX-r.left)*canvas.width/r.width,y:(t.clientY-r.top)*canvas.height/r.height}}
function start(e){drawing=true;last=pos(e);e.preventDefault()}function move(e){if(!drawing)return;let p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.lineWidth=3;ctx.lineCap="round";ctx.strokeStyle="#18202b";ctx.stroke();last=p;e.preventDefault()}function end(){drawing=false}
["mousedown","touchstart"].forEach(x=>canvas.addEventListener(x,start,{passive:false}));["mousemove","touchmove"].forEach(x=>canvas.addEventListener(x,move,{passive:false}));["mouseup","mouseleave","touchend"].forEach(x=>canvas.addEventListener(x,end));
$("#clearSignature").onclick=()=>ctx.clearRect(0,0,canvas.width,canvas.height);
$("#reviewBtn").onclick=()=>{
 draft.signature=canvas.toDataURL("image/png");
 $("#reviewCard").innerHTML=`<dl><dt>ID</dt><dd><b>${draft.id}</b></dd><dt>Endereço</dt><dd>${draft.address}, ${draft.number} — ${draft.neighborhood} — ${draft.city}</dd><dt>Tipo</dt><dd>${draft.type}</dd><dt>Valor</dt><dd>${money(draft.price)}</dd><dt>Características</dt><dd>${draft.rooms||0} quartos · ${draft.baths||0} banheiros · ${draft.parking||0} vagas · ${draft.area||0} m²</dd><dt>Proprietário</dt><dd>${draft.owner}</dd><dt>Fotos</dt><dd>${draft.photos.length}</dd><dt>Autorização</dt><dd>✓ Assinatura registrada</dd></dl>`;
 go("review");
};
$("#saveProperty").onclick=async()=>{
  try {
    await salvarNoSupabase(draft);

    properties = properties.filter(p => p.id !== draft.id);
    properties.unshift(draft);

    localStorage.setItem(
      "captalar_properties",
      JSON.stringify(properties)
    );

    toast("Imóvel salvo e sincronizado com a nuvem!");

    setTimeout(()=>go("home"),500);
  } catch (erro) {
    console.error("Erro ao salvar no Supabase:", erro);
    toast("Erro ao sincronizar. O imóvel não foi enviado.");
  }
};

function card(p){let img=p.photos?.[0];return `<div class="property-card">${img?`<img class="thumb" src="${img}">`:`<div class="thumb"></div>`}<div style="flex:1"><h3>${p.type} · ${p.id}</h3><p>${p.address}, ${p.number} · ${p.neighborhood}</p><p>${money(p.price)} · ${p.rooms||0} quartos · ${p.area||0} m²</p><span class="tag">${p.status}</span></div></div>`}
function refresh(){
 $("#totalCount").textContent=properties.length;$("#pendingCount").textContent=properties.filter(p=>p.status==="Em análise").length;
 $("#negotiationCount").textContent=properties.filter(p=>p.status==="Negociação").length;$("#closedCount").textContent=properties.filter(p=>["Vendido","Alugado","Concluído"].includes(p.status)).length;
 $("#recentList").innerHTML=properties.length?properties.slice(0,5).map(card).join(""):"Nenhum imóvel cadastrado ainda.";
 $("#allList").innerHTML=properties.length?properties.map(card).join(""):"Nenhum imóvel cadastrado.";
 $("#mTotal").textContent=properties.length;$("#mPending").textContent=properties.filter(p=>p.status==="Em análise").length;
 $("#mSent").textContent=properties.filter(p=>["Enviado","Em análise","Negociação"].includes(p.status)).length;$("#mClosed").textContent=properties.filter(p=>["Vendido","Alugado","Concluído"].includes(p.status)).length;
}
refresh();
carregarDoSupabase();

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").classList.remove("hidden")});
$("#installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt=null;$("#installBtn").classList.add("hidden")};
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
