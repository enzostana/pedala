"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Station, Position, distance, formatDistance } from "@/lib/stations";
import {
  NavigationRoute,
  projectRoute,
  remainingMeters,
  maneuverArrow,
} from "@/lib/navigation";
const Map = dynamic(() => import("./Map"), { ssr: false });
type Destination = {
  name: string;
  lat: number;
  lng: number;
  stationId?: number;
  approximate?: boolean;
};
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
    [results, setResults] = useState<Destination[]>([]),
    [route, setRoute] = useState<NavigationRoute | null>(null),
    [destination, setDestination] = useState<Destination | null>(null),
    [position, setPosition] = useState<Position | null>(null),
    [message, setMessage] = useState("Buscando GPS…"),
    [gps, setGps] = useState("Buscando GPS…"),
    [now, setNow] = useState(Date.now()),
    [view, setView] = useState({ kind: "user", tick: 0 }),
    [progress, setProgress] = useState({ index: 0, fraction: 0 }),
    [follow, setFollow] = useState(true),
    [arrived, setArrived] = useState(false),
    [gpsRetry, setGpsRetry] = useState(0);
  const positionRef = useRef<Position | null>(null),
    lastFixAt = useRef(0),
    routeRef = useRef<NavigationRoute | null>(null),
    destRef = useRef<Destination | null>(null),
    progressRef = useRef({ index: 0, fraction: 0 }),
    following = useRef(true),
    sampleRef = useRef<number[]>([]),
    rerouteAt = useRef(0),
    request = useRef<AbortController | null>(null),
    searchRequest = useRef<AbortController | null>(null),
    restore = useRef(false);
  const key = "pedala:destination:" + trip.id;
  const navigate = useCallback(
    async (d: Destination, p?: Position) => {
      const origin = p || positionRef.current;
      if (
        !origin ||
        origin.accuracy > 50 ||
        Date.now() - lastFixAt.current > 15000
      ) {
        setDestination(d);
        destRef.current = d;
        sessionStorage.setItem(key, JSON.stringify(d));
        setRoute(null);
        routeRef.current = null;
        setResults([]);
        setMessage("Aguardando sinal de GPS preciso para calcular a rota.");
        return;
      }
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setMessage("Calculando rota…");
      try {
        const res = await fetch("/api/navigation/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination: d }),
          signal: controller.signal,
        });
        const body = await res.json();
        if (controller.signal.aborted) return;
        if (!res.ok) throw Error(body.error);
        if (
          !Array.isArray(body.coordinates) ||
          body.coordinates.length < 2 ||
          !Array.isArray(body.maneuvers)
        )
          throw Error("Rota inválida.");
        setDestination(d);
        destRef.current = d;
        sessionStorage.setItem(key, JSON.stringify(d));
        setRoute(body);
        routeRef.current = body;
        progressRef.current = { index: 0, fraction: 0 };
        setProgress({ index: 0, fraction: 0 });
        setArrived(false);
        setResults([]);
        sampleRef.current = [];
        setMessage("Rota pronta.");
      } catch (e) {
        if ((e as Error).name !== "AbortError")
          setMessage(
            ((e instanceof TypeError
              ? "Sem conexão. Tente novamente."
              : (e as Error).message) ||
              "Rota indisponível. Tente novamente.") +
              (routeRef.current
                ? " A rota exibida pode estar desatualizada."
                : ""),
          );
      }
    },
    [key],
  );
  async function search() {
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setMessage("Buscando endereços…");
    try {
      const r = await fetch("/api/navigation/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query }),
        signal: controller.signal,
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setResults(j.results);
      setMessage(
        j.results.length
          ? "Escolha um destino."
          : "Nenhum endereço encontrado.",
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMessage(
          (e instanceof TypeError
            ? "Sem conexão. Tente novamente."
            : (e as Error).message) || "Busca indisponível.",
        );
    }
  }
  const stopFollowing = useCallback(() => {
    following.current = false;
    setFollow(false);
  }, []);
  function recenter() {
    following.current = true;
    setFollow(true);
    setView((v) => ({ kind: "user", tick: v.tick + 1 }));
  }
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(key) || "null");
      if (d?.name && Number.isFinite(d.lat) && Number.isFinite(d.lng)) {
        destRef.current = d;
        setDestination(d);
      }
    } catch {}
    return () => {
      request.current?.abort();
      searchRequest.current?.abort();
    };
  }, [key]);
  useEffect(() => {
    let id: number | undefined;
    function watch() {
      if (id !== undefined) {
        navigator.geolocation?.clearWatch(id);
        id = undefined;
      }
      if (document.hidden) {
        setGps("GPS pausado; rota pode estar desatualizada.");
        return;
      }
      setGps("Buscando GPS…");
      if (!navigator.geolocation) {
        setGps("GPS indisponível");
        return;
      }
      id = navigator.geolocation.watchPosition(
        (p) => {
          const point = {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
          };
          positionRef.current = point;
          setPosition(point);
          if (p.coords.accuracy > 50 || Date.now() - p.timestamp > 15000) {
            setGps(
              "Aguardando sinal de GPS preciso; rota pode estar desatualizada.",
            );
            return;
          }
          lastFixAt.current = p.timestamp;
          setGps("GPS ativo");
          if (following.current)
            setView((v) => ({ kind: "user", tick: v.tick + 1 }));
          const dest = destRef.current;
          const current = routeRef.current;
          if (
            dest &&
            !current &&
            !restore.current &&
            Date.now() - rerouteAt.current >= 30000
          ) {
            rerouteAt.current = Date.now();
            restore.current = true;
            void navigate(dest, point).finally(() => {
              restore.current = false;
            });
          }
          if (!dest || !current) return;
          const mapped = projectRoute(
            point,
            current.coordinates,
            progressRef.current.index,
          );
          if (mapped.offRoute > 50) {
            const t = Date.now();
            sampleRef.current.push(t);
            sampleRef.current = sampleRef.current.filter((x) => t - x <= 15000);
            if (
              sampleRef.current.length >= 3 &&
              t - sampleRef.current[0] >= 10000 &&
              t - rerouteAt.current >= 30000
            ) {
              rerouteAt.current = t;
              sampleRef.current = [];
              void navigate(dest, point);
            }
            return;
          }
          sampleRef.current = [];
          const next = {
            index: mapped.index,
            fraction:
              mapped.index === progressRef.current.index
                ? Math.max(mapped.fraction, progressRef.current.fraction)
                : mapped.fraction,
          };
          progressRef.current = next;
          setProgress(next);
          if (distance(point, dest) <= 30) {
            setArrived(true);
            setMessage(
              dest.stationId
                ? "Você chegou à estação. Confirme a devolução quando desejar."
                : "Você chegou ao destino. O aluguel continua ativo.",
            );
          }
        },
        () =>
          setGps(
            "GPS indisponível; rota pode estar desatualizada. Autorize a localização e tente novamente.",
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
  }, [navigate, gpsRetry]);
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(trip.started_at).getTime()) / 1000),
  );
  const remaining = route
    ? remainingMeters(route.coordinates, progress.index, progress.fraction)
    : 0;
  const eta =
    route && route.distanceMeters
      ? route.durationSeconds * Math.min(1, remaining / route.distanceMeters)
      : 0;
  const currentManeuver =
    route?.maneuvers.findIndex((m) => m.end > progress.index) ?? -1;
  const maneuver =
    route?.maneuvers[currentManeuver < 0 ? route.maneuvers.length - 1 : Math.min(currentManeuver + 1, route.maneuvers.length - 1)];
  const segment =
    route && maneuver
      ? remainingMeters(
          route.coordinates.slice(0, maneuver.begin + 1),
          progress.index,
          progress.fraction,
        )
      : 0;
  const routePoints = useMemo(
    () => route?.coordinates.map((p) => [p[1], p[0]] as [number, number]),
    [route],
  );
  const arrow = maneuver
    ? maneuverArrow(maneuver.type, maneuver.instruction)
    : "↑";
  function cancel() {
    request.current?.abort();
    setDestination(null);
    destRef.current = null;
    setRoute(null);
    routeRef.current = null;
    sessionStorage.removeItem(key);
    setArrived(false);
    setMessage("Navegação cancelada; o aluguel continua ativo.");
  }
  return (
    <section className="ridehud" aria-label="Navegação da pedalada">
      <div className="hudtop">
        <strong>
          {maneuver && !arrived
            ? `${arrow} ${maneuver.instruction} · ${formatDistance(segment)}`
            : "Boa pedalada! ↗"}
        </strong>
        <button onClick={onClose}>Minimizar mapa</button>
      </div>
      <Map
        stations={stations}
        route={routePoints}
        position={position}
        view={view}
        expanded
        onDrag={stopFollowing}
        onSelect={(s) =>
          navigate({ name: s.name, lat: s.lat, lng: s.lng, stationId: s.id })
        }
      />
      <div className="hudbottom">
        <span className="badge">VIAGEM EM ANDAMENTO</span>
        <h2>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </h2>
        <p>Bike {trip.bike} · aluguel gratuito</p>
        {destination && (
          <p>
            <strong>{destination.name}</strong>
            {destination.stationId && (
              <> · Estação {String(destination.stationId).padStart(2, "0")}</>
            )}
          </p>
        )}
        {route && (
          <p>
            {formatDistance(remaining)} restantes · {Math.ceil(eta / 60)} min ·
            chegada prevista{" "}
            {new Date(now + eta * 1000).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <input
            aria-label="Buscar destino"
            placeholder="Endereço no Rio"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button>Buscar destino</button>
        </form>
        <div className="hudresults">
          {results.map((d, i) => (
            <button key={i} onClick={() => navigate(d)}>
              {d.name}
              {d.stationId
                ? " — Estação " + String(d.stationId).padStart(2, "0")
                : ""}
              {d.approximate ? " · localização aproximada" : ""}
            </button>
          ))}
        </div>
        <p role="status">
          {message} {gps}
        </p>
        <div className="hudbuttons">
          <button onClick={() => setGpsRetry((v) => v + 1)}>
            Atualizar GPS
          </button>
          <button onClick={recenter}>
            {follow ? "Recentralizar" : "Retomar acompanhamento"}
          </button>
          {route && (
            <>
              <button
                onClick={() =>
                  setView((v) => ({ kind: "route", tick: v.tick + 1 }))
                }
              >
                Ver rota inteira
              </button>
              <button onClick={cancel}>Cancelar rota</button>
            </>
          )}
        </div>
        <label htmlFor="huddestination">Navegar até uma estação</label>
        <select
          id="huddestination"
          value=""
          onChange={(e) => {
            const s = stations.find((s) => s.id === Number(e.target.value));
            if (s)
              void navigate({
                name: s.name,
                lat: s.lat,
                lng: s.lng,
                stationId: s.id,
              });
          }}
        >
          <option value="">Escolha o destino</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — Estação {String(s.id).padStart(2, "0")} ·{" "}
              {s.capacity - s.available} vagas
            </option>
          ))}
        </select>
        <label htmlFor="hudstation">Escolher estação para devolver</label>
        <select
          id="hudstation"
          value=""
          onChange={(e) => {
            const s = stations.find((s) => s.id === Number(e.target.value));
            if (s) {
              onReturn(s);
            }
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
      </div>
    </section>
  );
}
