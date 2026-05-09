let mapa;
let grupoMarcadores;

function iniciarMapa(lat = -25.4284, lon = -49.2733) {
  mapa = L.map("map").setView([lat, lon], 14);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);

  grupoMarcadores = L.layerGroup().addTo(mapa);
}

iniciarMapa();

function pegarLocalizacao() {
  if (!navigator.geolocation) {
    alert("Seu navegador não suporta geolocalização.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(posicao) {
      const lat = posicao.coords.latitude;
      const lon = posicao.coords.longitude;

      mapa.setView([lat, lon], 15);
      grupoMarcadores.clearLayers();

      L.marker([lat, lon])
        .addTo(grupoMarcadores)
        .bindPopup("Você está aqui")
        .openPopup();

      buscarLocaisProximos(lat, lon);
    },
    function() {
      alert("Não foi possível obter sua localização.");
    }
  );
}

function buscarLocaisProximos(lat, lon) {
  const raio = 3000;

  const consulta = `
    [out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:${raio},${lat},${lon});
      way["amenity"="pharmacy"](around:${raio},${lat},${lon});
      relation["amenity"="pharmacy"](around:${raio},${lat},${lon});

      node["amenity"="fuel"](around:${raio},${lat},${lon});
      way["amenity"="fuel"](around:${raio},${lat},${lon});
      relation["amenity"="fuel"](around:${raio},${lat},${lon});
    );
    out center;
  `;

  fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: consulta
  })
    .then(resposta => resposta.json())
    .then(dados => mostrarLocais(dados.elements, lat, lon))
    .catch(erro => {
      console.error(erro);
      alert("Erro ao buscar locais próximos.");
    });
}

function mostrarLocais(locais, latUsuario, lonUsuario) {
  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  locais.forEach(local => {
    const lat = local.lat || local.center?.lat;
    const lon = local.lon || local.center?.lon;

    if (!lat || !lon) return;

    const nome = local.tags?.name || "Local sem nome";
    const tipo = local.tags?.amenity === "pharmacy" ? "Farmácia" : "Posto";
    const distancia = calcularDistancia(latUsuario, lonUsuario, lat, lon);

    const marcador = L.marker([lat, lon]).addTo(grupoMarcadores);

    marcador.bindPopup(`
      <strong>${nome}</strong><br>
      ${tipo}<br>
      ${distancia.toFixed(1)} km<br>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank">
        Ver rota
      </a>
    `);

    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${nome}</strong><br>
      ${tipo}<br>
      ${distancia.toFixed(1)} km<br>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank">
        Ver rota no Google Maps
      </a>
    `;

    lista.appendChild(item);
  });
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = grausParaRad(lat2 - lat1);
  const dLon = grausParaRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(grausParaRad(lat1)) *
    Math.cos(grausParaRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function grausParaRad(graus) {
  return graus * Math.PI / 180;
}
