"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Station, Position } from "@/lib/stations";
const Map = dynamic(() => import("./Map"), { ssr: false });
export default function RideHUD({
  trip,
  stations,
  onClose,
  onReturn,
}: {
  trip: any;
  stations: Station[];
  onClose: () => void;
  onReturn: (s: Station) => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<any[]>([]),
    [route, setRoute] = useState<[number, number][]>([]),
    [summary, setSummary] = useState("");
  async function search() {
    const r = await fetch("/api/navigation/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: query }),
    });
    const j = await r.json();
    if (!r.ok) setStatus(j.error);
    else setResults(j.results);
  }
  async function navigate(d: any) {
    if (!pos) {
      setStatus("Aguardando GPS para calcular rota.");
      return;
    }
    const r = await fetch("/api/navigation/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: pos, destination: d }),
    });
    const j = await r.json();
    if (!r.ok) {
      setStatus(j.error);
      return;
    }
    const f = j.features?.[0];
    setRoute(
      (f.geometry.type === "MultiLineString"
        ? f.geometry.coordinates.flat()
        : f.geometry.coordinates
      ).map((p: number[]) => [p[1], p[0]]),
    );
    setSummary(
      d.name +
        " · " +
        (f.properties.distance / 1000).toFixed(1) +
        " km · " +
        Math.ceil(f.properties.time / 60) +
        " min",
    );
    setResults([]);
  }
  const [pos, setPos] = useState<Position | null>(null),
    [status, setStatus] = useState("Buscando GPS…"),
    [now, setNow] = useState(Date.now()),
    [view, setView] = useState({ kind: "user", tick: 0 });
  useEffect(() => {
    let id: number | undefined;
    function watch() {
      if (document.hidden) {
        if (id !== undefined) navigator.geolocation?.clearWatch(id);
        return;
      }
      if (!navigator.geolocation) {
        setStatus("GPS indisponível");
        return;
      }
      id = navigator.geolocation.watchPosition(
        (p) => {
          setPos({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
          });
          setStatus("GPS ativo");
          setView((v) => ({ kind: "user", tick: v.tick + 1 }));
        },
        () =>
          setStatus(
            "GPS indisponível. Autorize a localização ou tente novamente.",
          ),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
      );
    }
    watch();
    document.addEventListener("visibilitychange", watch);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (id !== undefined) navigator.geolocation?.clearWatch(id);
      clearInterval(t);
      document.removeEventListener("visibilitychange", watch);
    };
  }, []);
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(trip.started_at).getTime()) / 1000),
  );
  return (
    <section className="ridehud" aria-label="Navegação da pedalada">
      <div className="hudtop">
        <strong>Boa pedalada! ↗</strong>
        <button onClick={onClose}>Minimizar mapa</button>
      </div>
      <Map
        stations={stations}
        route={route}
        position={pos}
        view={view}
        expanded
        onSelect={onReturn}
      />
      <div className="hudbottom">
        <span className="badge">VIAGEM EM ANDAMENTO</span>
        <h2>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </h2>
        <p>Bike {trip.bike} · aluguel gratuito</p>
        <p>{summary}</p>
        <input
          aria-label="Buscar destino"
          placeholder="Endereço no Rio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={search}>Buscar destino</button>
        {results.map((d, i) => (
          <button key={i} onClick={() => navigate(d)}>
            {d.name}
          </button>
        ))}
        <p role="status">{status}</p>
        <button
          onClick={() => setView((v) => ({ kind: "user", tick: v.tick + 1 }))}
        >
          Recentralizar
        </button>
        <label htmlFor="hudstation">Escolher estação para devolver</label>
        <select
          id="hudstation"
          defaultValue=""
          onChange={(e) => {
            const s = stations.find((s) => s.id === Number(e.target.value));
            if (s) onReturn(s);
          }}
        >
          <option value="">Selecione uma estação</option>
          {stations.map((s) => (
            <option
              key={s.id}
              value={s.id}
              disabled={s.available >= s.capacity}
            >
              {s.name} — Estação {String(s.id).padStart(2, "0")} ·{" "}
              {s.capacity - s.available} vagas
            </option>
          ))}
        </select>
        <p className="fine">
          Busca de endereços e rotas dependem da configuração Geoapify.
        </p>
      </div>
    </section>
  );
}
