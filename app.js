const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
let properties=JSON.parse(localStorage.getItem("captalar_properties")||"[]");
let draft={photos:[],signature:null};
let deferredPrompt=null;
let editingId=null;

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
draft={
    ...draft,
    id:editingId || idFor(),
    address:$("#address").value,
    number:$("#number").value,
    neighborhood:$("#neighborhood").value,
    city:$("#city").value,
    cep:$("#cep").value,
    type:$("#type").value,
    price:$("#price").value,
    rooms:$("#rooms").value,
    baths:$("#baths").value,
    parking:$("#parking").value,
    area:$("#area").value,
    description:$("#description").value,
    owner:$("#owner").value,
    phone:$("#phone").value,
    whatsapp:$("#whatsapp").value,
    email:$("#email").value,
    status:"Enviado",
       created:draft.created || new Date().toISOString()
 };

 $("#photoInput").value="";
 renderPhotos();
 go("photos");
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
$("#toSignature").onclick=()=>{if(!draft.photos.length){toast("Adicione pelo menos uma foto.");return}go("signature")};

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
$("#saveProperty").onclick=()=>{
    if(editingId){
        const index=properties.findIndex(x=>x.id===editingId);

        if(index!==-1){
            properties[index]=draft;
        }

        editingId=null;
        toast("Imóvel atualizado com sucesso!");
    }else{
        properties.unshift(draft);
        toast("Imóvel salvo com sucesso!");
    }

    localStorage.setItem("captalar_properties",JSON.stringify(properties));

    setTimeout(()=>go("home"),500);
};

function card(p){
    let img=p.photos?.[0];

    return `
    <div class="property-card">
        ${img ? `<img class="thumb" src="${img}">` : `<div class="thumb"></div>`}

        <div style="flex:1">
            <h3>${p.type} · ${p.id}</h3>
            <p>${p.address}, ${p.number} · ${p.neighborhood}</p>
            <p>${money(p.price)} · ${p.rooms || 0} quartos · ${p.area || 0} m²</p>
            <span class="tag">${p.status}</span>

            <div style="display:flex;gap:8px;margin-top:10px">
                <button class="secondary" onclick="editProperty('${p.id}')">✏️ Editar</button>
                <button class="secondary" onclick="deleteProperty('${p.id}')">🗑️ Excluir</button>
            </div>
        </div>
    </div>`;
}
refresh();
function deleteProperty(id){
    const p = properties.find(x => x.id === id);
    if(!p) return;

    if(!confirm(`Excluir o imóvel ${p.id}?`)) return;

    properties = properties.filter(x => x.id !== id);
    localStorage.setItem("captalar_properties", JSON.stringify(properties));

    toast("Imóvel excluído.");
    refresh();
}

function editProperty(id){
    const p = properties.find(x => x.id === id);
    if(!p) return;
editingId=id;
    $("#address").value = p.address || "";
    $("#number").value = p.number || "";
    $("#neighborhood").value = p.neighborhood || "";
    $("#city").value = p.city || "";
    $("#cep").value = p.cep || "";
    $("#type").value = p.type || "";
    $("#price").value = p.price || "";
    $("#rooms").value = p.rooms || "";
    $("#baths").value = p.baths || "";
    $("#parking").value = p.parking || "";
    $("#area").value = p.area || "";
    $("#description").value = p.description || "";
    $("#owner").value = p.owner || "";
    $("#phone").value = p.phone || "";
    $("#whatsapp").value = p.whatsapp || "";
    $("#email").value = p.email || "";

    draft = {...p};

    toast("Imóvel carregado para edição.");
    go("new");
}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").classList.remove("hidden")});
$("#installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt=null;$("#installBtn").classList.add("hidden")};
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
