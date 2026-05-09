let mapa;
let grupoMarcadores;
let buscaAtual = 0;

function iniciarMapa(lat = -25.4284, lon = -49.2733) {
  mapa = L.map("map").setView([lat, lon], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);

  grupoMarcadores = L.layerGroup().addTo(mapa);
}

iniciarMapa();

document.getElementById("campoLocalizacao").addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    buscarPorTexto();
  }
});

function setStatus(texto) {
  document.getElementById("status").textContent = texto;
}

function setCarregando(estado) {
  document.getElementById("botaoBuscar").disabled = estado;
  document.getElementById("botaoLocalizacao").disabled = estado;
}

function pegarLocalizacao() {
  if (!navigator.geolocation) {
    alert("Seu navegador não suporta geolocalização.");
    return;
  }

  setCarregando(true);
  setStatus("Obtendo sua localização...");

  navigator.geolocation.getCurrentPosition(
    function(posicao) {
      const lat = posicao.coords.latitude;
      const lon = posicao.coords.longitude;

      centralizarBusca(lat, lon, "Você está aqui");
    },
    function() {
      alert("Não foi possível obter sua localização.");
      setStatus("Não foi possível obter sua localização.");
      setCarregando(false);
    }
  );
}

function buscarPorTexto() {
  const localDigitado = document.getElementById("campoLocalizacao").value.trim();

  if (localDigitado === "") {
    alert("Digite uma cidade, bairro ou endereço.");
    return;
  }

  setCarregando(true);
  setStatus("Buscando localização...");

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=pt-BR&q=${encodeURIComponent(localDigitado)}`;

  fetch(url)
    .then(resposta => resposta.json())
    .then(dados => {
      if (dados.length === 0) {
        alert("Localização não encontrada.");
        setStatus("Localização não encontrada.");
        setCarregando(false);
        return;
      }

      const lat = parseFloat(dados[0].lat);
      const lon = parseFloat(dados[0].lon);
      const nomeLocal = dados[0].display_name || localDigitado;

      centralizarBusca(lat, lon, nomeLocal);
    })
    .catch(erro => {
      console.error(erro);
      alert("Erro ao buscar a localização digitada.");
      setStatus("Erro ao buscar a localização digitada.");
      setCarregando(false);
    });
}

function centralizarBusca(lat, lon, texto) {
  buscaAtual++;
  const idBusca = buscaAtual;

  mapa.setView([lat, lon], 15);
  grupoMarcadores.clearLayers();

  L.marker([lat, lon])
    .addTo(grupoMarcadores)
    .bindPopup(texto)
    .openPopup();

  buscarFarmaciasProximas(lat, lon, idBusca);
}

function buscarFarmaciasProximas(lat, lon, idBusca) {
  setStatus("Buscando farmácias próximas...");

  const raio = 3000;

  const consulta = `
    [out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:${raio},${lat},${lon});
      way["amenity"="pharmacy"](around:${raio},${lat},${lon});
      relation["amenity"="pharmacy"](around:${raio},${lat},${lon});
    );
    out center tags;
  `;

  fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: consulta
  })
    .then(resposta => resposta.json())
    .then(dados => {
      if (idBusca !== buscaAtual) return;
      mostrarFarmacias(dados.elements, lat, lon, idBusca);
    })
    .catch(erro => {
      console.error(erro);
      alert("Erro ao buscar farmácias próximas.");
      setStatus("Erro ao buscar farmácias próximas.");
      setCarregando(false);
    });
}

async function mostrarFarmacias(farmacias, latUsuario, lonUsuario, idBusca) {
  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  if (!farmacias || farmacias.length === 0) {
    lista.innerHTML = "<li>Nenhuma farmácia encontrada nessa região.</li>";
    setStatus("Nenhuma farmácia encontrada nessa região.");
    setCarregando(false);
    return;
  }

  let farmaciasTratadas = farmacias
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
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 10);

  if (farmaciasTratadas.length === 0) {
    lista.innerHTML = "<li>Nenhuma farmácia encontrada nessa região.</li>";
    setStatus("Nenhuma farmácia encontrada nessa região.");
    setCarregando(false);
    return;
  }

  setStatus("Carregando endereços aproximados...");

  for (let i = 0; i < farmaciasTratadas.length; i++) {
    if (idBusca !== buscaAtual) return;

    if (farmaciasTratadas[i].endereco === "Endereço não informado") {
      farmaciasTratadas[i].endereco = await buscarEnderecoPorCoordenada(
        farmaciasTratadas[i].lat,
        farmaciasTratadas[i].lon
      );

      await esperar(1000);
    }
  }

  if (idBusca !== buscaAtual) return;

  lista.innerHTML = "";

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
      <strong>${farmacia.nome}</strong>
      <div class="endereco">${farmacia.endereco}</div>
      <div class="distancia">${farmacia.distancia.toFixed(1)} km de distância</div>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${farmacia.lat},${farmacia.lon}" target="_blank">
        Ver rota no Google Maps
      </a>
    `;

    lista.appendChild(item);
  });

  setStatus(`${farmaciasTratadas.length} farmácia(s) encontrada(s).`);
  setCarregando(false);
}

function montarEndereco(tags) {
  if (!tags) return "Endereço não informado";

  if (tags["addr:full"]) {
    return tags["addr:full"];
  }

  const rua = tags["addr:street"] || "";
  const numero = tags["addr:housenumber"] || "";
  const bairro = tags["addr:suburb"] || tags["addr:neighbourhood"] || "";
  const cidade = tags["addr:city"] || tags["addr:municipality"] || "";
  const estado = tags["addr:state"] || "";
  const cep = tags["addr:postcode"] || "";

  const partes = [
    rua && numero ? `${rua}, ${numero}` : rua,
    bairro,
    cidade,
    estado,
    cep
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" - ") : "Endereço não informado";
}

async function buscarEnderecoPorCoordenada(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=pt-BR`;

  try {
    const resposta = await fetch(url);
    const dados = await resposta.json();

    if (dados.address) {
      const rua = dados.address.road || dados.address.pedestrian || dados.address.footway || "";
      const numero = dados.address.house_number || "";
      const bairro = dados.address.suburb || dados.address.neighbourhood || dados.address.city_district || "";
      const cidade = dados.address.city || dados.address.town || dados.address.village || "";
      const estado = dados.address.state || "";

      const partes = [
        rua && numero ? `${rua}, ${numero}` : rua,
        bairro,
        cidade,
        estado
      ].filter(Boolean);

      if (partes.length > 0) {
        return partes.join(" - ");
      }
    }

    if (dados.display_name) {
      return dados.display_name;
    }

    return "Endereço aproximado não encontrado";
  } catch (erro) {
    console.error("Erro na busca reversa:", erro);
    return "Endereço aproximado não encontrado";
  }
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

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
