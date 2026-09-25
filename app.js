const $ = (s) => document.querySelector(s),
  $$ = (s) => document.querySelectorAll(s);
let properties = JSON.parse(
  localStorage.getItem("captalar_properties") || "[]",
);
let draft = { photos: [], signature: null };
let deferredPrompt = null;
let editingProperty = false;

const SUPABASE_URL = "https://emvmzkenynkqqmzrqxqi.supabase.co";
const SUPABASE_KEY = "sb_publishable_2VCIY9lN322gBZuh3fu9Eg_hNUmvTA7";

async function supabaseRequest(path, options = {}) {
  const response = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Erro HTTP ${response.status}`);
  }

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function carregarDoSupabase() {
  try {
    const rows = await supabaseRequest(
      "/rest/v1/properties?select=id,data,created_at&order=created_at.desc",
    );

    const locais = properties || [];
    const mapa = new Map();

    locais.forEach((p) => {
      if (p?.id) mapa.set(p.id, p);
    });

    rows.forEach((row) => {
      if (row?.data?.id) {
        mapa.set(row.data.id, row.data);
      }
    });

    properties = Array.from(mapa.values());

    properties.sort((a, b) =>
      String(b.created || "").localeCompare(String(a.created || "")),
    );

    localStorage.setItem("captalar_properties", JSON.stringify(properties));

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
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: imovel.id,
      data: imovel,
    }),
  });
}
function go(id) {
  if (id === "new" && !editingProperty) {
    draft = {
      photos: [],
      signature: null,
    };
  }
  $$(".screen").forEach((x) => x.classList.remove("active"));

  $("#" + id).classList.add("active");

  window.scrollTo(0, 0);

  refresh();
}
$$("[data-go]").forEach((b) =>
  b.addEventListener("click", () => go(b.dataset.go)),
);
function toast(t) {
  let x = $("#toast");
  x.textContent = t;
  x.classList.add("show");
  setTimeout(() => x.classList.remove("show"), 2500);
}
function money(v) {
  return v
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(String(v).replace(",", ".")))
    : "Não informado";
}
function idFor() {
  return "000" + String(Date.now()).slice(-3);
}

$("#geoBtn").onclick = () => {
  if (!navigator.geolocation) {
    toast("GPS não disponível neste navegador.");
    return;
  }
  $("#geoStatus").textContent = "Obtendo localização…";
  navigator.geolocation.getCurrentPosition(
    async (p) => {
      const lat = p.coords.latitude.toFixed(6),
        lon = p.coords.longitude.toFixed(6);
      $("#geoStatus").textContent =
        `GPS: ${lat}, ${lon}. Confirme o endereço abaixo.`;
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=pt-BR`,
        );
        const d = await r.json(),
          a = d.address || {};
        $("#address").value = a.road || a.pedestrian || "";
        $("#number").value = a.house_number || "";
        $("#neighborhood").value =
          a.suburb || a.neighbourhood || a.city_district || "";
        $("#city").value =
          (a.city || a.town || a.municipality || "") +
          " - " +
          (a.state || "SP");
        $("#cep").value = a.postcode || "";
        toast("Endereço encontrado. Confira antes de salvar.");
      } catch (e) {
        toast("GPS obtido. Preencha/confirme o endereço.");
      }
      draft.lat = lat;
      draft.lon = lon;
    },
    () => {
      $("#geoStatus").textContent =
        "Não foi possível obter o GPS. Verifique a permissão do navegador.";
    },
  );
};

$("#propertyForm").onsubmit = (e) => {
  e.preventDefault();

  const idExistente = draft.id;
  const fotosExistentes = draft.photos || [];
  const assinaturaExistente = draft.signature || null;

  draft = {
    ...draft,

    id: editingProperty ? idExistente : idFor(),

    address: $("#address").value,
    number: $("#number").value,
    neighborhood: $("#neighborhood").value,
    city: $("#city").value,
    cep: $("#cep").value,
    type: $("#type").value,
    price: $("#price").value,
    rooms: $("#rooms").value,
    baths: $("#baths").value,
    parking: $("#parking").value,
    area: $("#area").value,
    description: $("#description").value,
    owner: $("#owner").value,
    phone: $("#phone").value,
    whatsapp: $("#whatsapp").value,
    email: $("#email").value,

    status: $("#status") ? $("#status").value : draft.status || "Enviado",

    created: editingProperty
      ? draft.created || new Date().toISOString()
      : new Date().toISOString(),

    photos: fotosExistentes,
    signature: assinaturaExistente,
  };

  $("#photoGrid").innerHTML = "";
  $("#photoInput").value = "";

  renderPhotos();

  go("photos");
};

$("#cameraBtn").onclick = () => $("#photoInput").click();
$("#photoInput").onchange = (e) => {
  [...e.target.files].forEach((file) => {
    const r = new FileReader();
    r.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"),
          max = 1200,
          s = Math.min(1, max / img.width);
        c.width = img.width * s;
        c.height = img.height * s;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ctx.fillStyle = "rgba(8,38,70,.78)";
        ctx.fillRect(0, c.height - 52, c.width, 52);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px Arial";
        ctx.fillText("CAPTALAR", 16, c.height - 28);
        ctx.font = "bold 15px Arial";
        ctx.fillText("ID: " + draft.id, 150, c.height - 29);
        draft.photos.push(c.toDataURL("image/jpeg", 0.78));
        renderPhotos();
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(file);
  });
};
function renderPhotos() {
  $("#photoGrid").innerHTML =
    draft.photos
      .map(
        (p, index) => `
      <div class="photo-item">
        <img src="${p}" alt="Foto do imóvel">

        <button
          type="button"
          class="delete-photo"
          data-index="${index}"
          title="Apagar foto"
        >
          🗑️
        </button>
      </div>
    `,
      )
      .join("") || '<div class="hint">Nenhuma foto adicionada.</div>';
}
$("#photoGrid").onclick = (e) => {
  const botao = e.target.closest(".delete-photo");

  if (!botao) return;

  const index = Number(botao.dataset.index);

  draft.photos.splice(index, 1);

  renderPhotos();

  toast("Foto removida.");
};
$("#toSignature").onclick = () => {
  if (!draft.photos.length) {
    toast("Adicione pelo menos uma foto.");
    return;
  }

  go("signatureScreen");

  setTimeout(() => {
    carregarAssinatura();
  }, 50);
};

// assinatura com mouse/toque
const canvas = $("#signature"),
  ctx = canvas.getContext("2d");
let drawing = false,
  last = null;
function pos(e) {
  const r = canvas.getBoundingClientRect(),
    t = e.touches?.[0] || e;
  return {
    x: ((t.clientX - r.left) * canvas.width) / r.width,
    y: ((t.clientY - r.top) * canvas.height) / r.height,
  };
}
function start(e) {
  drawing = true;
  last = pos(e);
  e.preventDefault();
}
function move(e) {
  if (!drawing) return;
  let p = pos(e);
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#18202b";
  ctx.stroke();
  last = p;
  e.preventDefault();
}
function end() {
  drawing = false;
}
["mousedown", "touchstart"].forEach((x) =>
  canvas.addEventListener(x, start, { passive: false }),
);
["mousemove", "touchmove"].forEach((x) =>
  canvas.addEventListener(x, move, { passive: false }),
);
["mouseup", "mouseleave", "touchend"].forEach((x) =>
  canvas.addEventListener(x, end),
);
$("#clearSignature").onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  draft.signature = null;
};

function carregarAssinatura() {
  if (!draft.signature) return;

  const img = new Image();

  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  img.src = draft.signature;
}

$("#reviewBtn").onclick = () => {
  draft.signature = canvas.toDataURL("image/png");

  $("#reviewCard").innerHTML =
    `<dl><dt>ID</dt><dd><b>${draft.id}</b></dd><dt>Endereço</dt><dd>${draft.address}, ${draft.number} — ${draft.neighborhood} — ${draft.city}</dd><dt>Tipo</dt><dd>${draft.type}</dd><dt>Valor</dt><dd>${money(draft.price)}</dd><dt>Características</dt><dd>${draft.rooms || 0} quartos · ${draft.baths || 0} banheiros · ${draft.parking || 0} vagas · ${draft.area || 0} m²</dd><dt>Proprietário</dt><dd>${draft.owner}</dd><dt>Fotos</dt><dd>${draft.photos.length}</dd><dt>Autorização</dt><dd>✓ Assinatura registrada</dd></dl>`;

  go("review");
};

$("#saveProperty").onclick = async () => {
  try {
    const normalize = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");

    const chaveImovel = (p) =>
      [
        normalize(p.address),
        normalize(p.number),
        normalize(p.neighborhood),
        normalize(p.city),
      ].join("|");

    const chaveAtual = chaveImovel(draft);

    const duplicado = properties.find(
      (p) => p.id !== draft.id && chaveImovel(p) === chaveAtual,
    );

    if (duplicado) {
      toast("Este imóvel já está cadastrado.");
      return;
    }

    await salvarNoSupabase(draft);

    properties = properties.filter((p) => p.id !== draft.id);
    properties.unshift(draft);

    localStorage.setItem("captalar_properties", JSON.stringify(properties));

    toast("Imóvel salvo e sincronizado com a nuvem!");

    setTimeout(() => go("home"), 500);
  } catch (erro) {
    console.error("Erro ao salvar no Supabase:", erro);
    toast("Erro ao sincronizar. O imóvel não foi enviado.");
  }
};

function card(p) {
  let img = p.photos?.[0];

  return `
    <div class="property-card">

      ${
        img
          ? `<img class="thumb" src="${img}" alt="Foto do imóvel">`
          : `<div class="thumb no-photo">🏠</div>`
      }

      <div class="property-info">

        <div class="property-title">
          <div>
            <h3>${p.type || "Imóvel"}</h3>
            <span class="property-id">Código ${Number(p.id)}</span>
          </div>

          <span class="tag">${p.status || "Enviado"}</span>
        </div>

        <p class="property-address">
          📍 ${p.address || "Endereço não informado"}${
            p.number ? `, ${p.number}` : ""
          }
          ${p.neighborhood ? ` · ${p.neighborhood}` : ""}
        </p>

        <p class="property-details">
          <strong>${money(p.price)}</strong>
          <span>·</span>
          <span>🛏️ ${p.rooms || 0} quartos</span>
          <span>·</span>
          <span>📐 ${p.area || 0} m²</span>
        </p>

        <div class="property-actions">
          <button
            class="secondary edit-property"
            data-id="${p.id}"
          >
            ✏️ Editar
          </button>
        </div>

      </div>
    </div>
  `;
}

function editarImovel(id) {
  const imovel = properties.find((p) => p.id === id);

  if (!imovel) {
    toast("Imóvel não encontrado.");
    return;
  }

  draft = {
    ...imovel,
    photos: [...(imovel.photos || [])],
    signature: imovel.signature || null,
  };

  editingProperty = true;

  $("#address").value = draft.address || "";
  $("#number").value = draft.number || "";
  $("#neighborhood").value = draft.neighborhood || "";
  $("#city").value = draft.city || "";
  $("#cep").value = draft.cep || "";

  $("#type").value = draft.type || "Casa";
  $("#price").value = draft.price || "";
  $("#rooms").value = draft.rooms || "";
  $("#baths").value = draft.baths || "";
  $("#parking").value = draft.parking || "";
  $("#area").value = draft.area || "";

  $("#description").value = draft.description || "";
  if ($("#status")) {
    $("#status").value = draft.status || "Enviado";
  }
  $("#owner").value = draft.owner || "";
  $("#phone").value = draft.phone || "";
  $("#whatsapp").value = draft.whatsapp || "";
  $("#email").value = draft.email || "";

  renderPhotos();

  go("new");
}
function refresh() {
  $("#totalCount").textContent = properties.length;

  $("#pendingCount").textContent = properties.filter(
    (p) => p.status === "Em análise",
  ).length;

  $("#negotiationCount").textContent = properties.filter(
    (p) => p.status === "Negociação",
  ).length;

  $("#closedCount").textContent = properties.filter((p) =>
    ["Vendido", "Alugado", "Concluído"].includes(p.status),
  ).length;

  $("#recentList").innerHTML = properties.length
    ? properties.slice(0, 5).map(card).join("")
    : "Nenhum imóvel cadastrado ainda.";

  $("#allList").innerHTML = properties.length
    ? properties.map(card).join("")
    : "Nenhum imóvel cadastrado.";

  $("#mTotal").textContent = properties.length;

  $("#mPending").textContent = properties.filter(
    (p) => p.status === "Em análise",
  ).length;

  $("#mSent").textContent = properties.filter((p) =>
    ["Enviado", "Em análise", "Negociação"].includes(p.status),
  ).length;

  $("#mClosed").textContent = properties.filter((p) =>
    ["Vendido", "Alugado", "Concluído"].includes(p.status),
  ).length;
}

$("#recentList").onclick = (e) => {
  const botao = e.target.closest(".edit-property");

  if (!botao) return;

  editarImovel(botao.dataset.id);
};
$("#allList").onclick = (e) => {
  const botao = e.target.closest(".edit-property");

  if (!botao) return;

  editarImovel(botao.dataset.id);
};

function aplicarFiltros() {
  const texto = String($("#propertySearch")?.value || "")
    .trim()
    .toLowerCase();

  const tipo = String($("#filterType")?.value || "")
    .trim()
    .toLowerCase();

  const status = String($("#filterStatus")?.value || "")
    .trim()
    .toLowerCase();

  const filtrados = properties.filter((p) => {
    const dadosPesquisa = [p.id, p.address, p.number, p.neighborhood, p.city]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const correspondeTexto = !texto || dadosPesquisa.includes(texto);

    const correspondeTipo =
      !tipo || String(p.type || "").toLowerCase() === tipo;

    const correspondeStatus =
      !status || String(p.status || "").toLowerCase() === status;

    return correspondeTexto && correspondeTipo && correspondeStatus;
  });

  $("#allList").innerHTML = filtrados.length
    ? filtrados.map(card).join("")
    : "Nenhum imóvel encontrado.";

  $("#filterCount").textContent =
    `${filtrados.length} imóvel${filtrados.length === 1 ? "" : "is"} encontrado${filtrados.length === 1 ? "" : "s"}.`;
}

$("#propertySearch")?.addEventListener("input", aplicarFiltros);

$("#filterType")?.addEventListener("change", aplicarFiltros);

$("#filterStatus")?.addEventListener("change", aplicarFiltros);

$("#clearFilters")?.addEventListener("click", () => {
  $("#propertySearch").value = "";
  $("#filterType").value = "";
  $("#filterStatus").value = "";

  aplicarFiltros();
});

refresh();

carregarDoSupabase();
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("#installBtn").classList.remove("hidden");
});
$("#installBtn").onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt = null;
  $("#installBtn").classList.add("hidden");
};
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("sw.js").catch(() => {});
