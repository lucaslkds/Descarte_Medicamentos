let mapa;
let grupoMarcadores;

function iniciarMapa(lat = -25.4284, lon = -49.2733) {
  mapa = L.map("map").setView([lat, lon], 13);

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

      centralizarBusca(lat, lon, "Você está aqui");
    },
    function() {
      alert("Não foi possível obter sua localização.");
    }
  );
}

function buscarPorTexto() {
  const localDigitado = document.getElementById("campoLocalizacao").value.trim();

  if (localDigitado === "") {
    alert("Digite uma cidade, bairro ou endereço.");
    return;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(localDigitado)}`;

  fetch(url)
    .then(resposta => resposta.json())
    .then(dados => {
      if (dados.length === 0) {
        alert("Localização não encontrada.");
        return;
      }

      const lat = parseFloat(dados[0].lat);
      const lon = parseFloat(dados[0].lon);

      centralizarBusca(lat, lon, localDigitado);
    })
    .catch(erro => {
      console.error(erro);
      alert("Erro ao buscar a localização digitada.");
    });
}

function centralizarBusca(lat, lon, texto) {
  mapa.setView([lat, lon], 15);
  grupoMarcadores.clearLayers();

  L.marker([lat, lon])
    .addTo(grupoMarcadores)
    .bindPopup(texto)
    .openPopup();

  buscarFarmaciasProximas(lat, lon);
}

function buscarFarmaciasProximas(lat, lon) {
  const raio = 3000;

  const consulta = `
    [out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:${raio},${lat},${lon});
      way["amenity"="pharmacy"](around:${raio},${lat},${lon});
      relation["amenity"="pharmacy"](around:${raio},${lat},${lon});
    );
    out center;
  `;

  fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: consulta
  })
    .then(resposta => resposta.json())
    .then(dados => mostrarFarmacias(dados.elements, lat, lon))
    .catch(erro => {
      console.error(erro);
      alert("Erro ao buscar farmácias próximas.");
    });
}

function mostrarFarmacias(farmacias, latUsuario, lonUsuario) {
  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  if (farmacias.length === 0) {
    lista.innerHTML = "<li>Nenhuma farmácia encontrada nessa região.</li>";
    return;
  }

  const farmaciasTratadas = farmacias
    .map(farmacia => {
      const lat = farmacia.lat || farmacia.center?.lat;
      const lon = farmacia.lon || farmacia.center?.lon;

      if (!lat || !lon) return null;

      return {
        nome: farmacia.tags?.name || "Farmácia sem nome",
        endereco: montarEndereco(farmacia.tags),
        lat,
        lon,
        distancia: calcularDistancia(latUsuario, lonUsuario, lat, lon)
      };
    })
    .filter(farmacia => farmacia !== null)
    .sort((a, b) => a.distancia - b.distancia);

  farmaciasTratadas.forEach(farmacia => {
    const marcador = L.marker([farmacia.lat, farmacia.lon]).addTo(grupoMarcadores);

    marcador.bindPopup(`
      <strong>${farmacia.nome}</strong><br>
      ${farmacia.endereco}<br>
      ${farmacia.distancia.toFixed(1)} km<br>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${farmacia.lat},${farmacia.lon}" target="_blank">
        Ver rota
      </a>
    `);

    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${farmacia.nome}</strong><br>
      ${farmacia.endereco}<br>
      ${farmacia.distancia.toFixed(1)} km<br>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${farmacia.lat},${farmacia.lon}" target="_blank">
        Ver rota no Google Maps
      </a>
    `;

    lista.appendChild(item);
  });
}

function montarEndereco(tags) {
  if (!tags) return "Endereço não informado";

  const rua = tags["addr:street"] || "";
  const numero = tags["addr:housenumber"] || "";
  const bairro = tags["addr:suburb"] || "";
  const cidade = tags["addr:city"] || "";

  const endereco = `${rua} ${numero} ${bairro} ${cidade}`.trim();

  return endereco || "Endereço não informado";
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
