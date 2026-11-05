"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Station, Position, distance, formatDistance } from "@/lib/stations";
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="map">Carregando mapa… Use a lista de estações abaixo.</div>
  ),
});
export default function Discovery({
  stations,
  onSelect,
  chosen,
}: {
  stations: Station[];
  onSelect: (s: Station) => void;
  chosen: Station | null;
}) {
  const [position, setPosition] = useState<Position | null>(null),
    [status, setStatus] = useState("Buscando sua localização…"),
    [filter, setFilter] = useState("all"),
    [expanded, setExpanded] = useState(false),
    [view, setView] = useState({ kind: "uva", tick: 0 });
  const boot = useRef(false),
    expandButton = useRef<HTMLButtonElement>(null),
    closeButton = useRef<HTMLButtonElement>(null),
    overlay = useRef<HTMLDivElement>(null);
  function locate() {
    setStatus("Buscando sua localização…");
    if (!navigator.geolocation) {
      setStatus("Localização indisponível. Mostrando a região da UVA.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
        setStatus("Distâncias aproximadas em linha reta.");
        setView((v) => ({ kind: "user", tick: v.tick + 1 }));
      },
      (e) => {
        setStatus(
          e.code === 1
            ? "Localização não autorizada. Você pode explorar o mapa ou tentar novamente."
            : "Não foi possível obter sua localização. Tente novamente.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  useEffect(() => {
    if (!boot.current) {
      boot.current = true;
      locate();
    }
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
        expandButton.current?.focus();
      }
      if (e.key === "Tab") {
        const nodes = overlay.current?.querySelectorAll<HTMLElement>(
          'button,a[href],[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", listener);
    };
  }, [expanded]);
  const visible = stations
    .filter((s) =>
      filter === "bikes"
        ? s.available > 0
        : filter === "spaces"
          ? s.available < s.capacity
          : true,
    )
    .sort((a, b) =>
      position
        ? distance(position, a) - distance(position, b) || a.id - b.id
        : a.id - b.id,
    );
  return (
    <section>
      <div
        ref={overlay}
        className={expanded ? "mapoverlay" : ""}
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? "Mapa ampliado" : undefined}
      >
        <div className="maptools">
          <button onClick={locate}>Minha localização</button>
          <button
            onClick={() => setView((v) => ({ kind: "all", tick: v.tick + 1 }))}
          >
            Ver todas as estações
          </button>
          <button
            onClick={() => setView((v) => ({ kind: "uva", tick: v.tick + 1 }))}
          >
            Ir para UVA
          </button>
          {expanded ? (
            <button
              ref={closeButton}
              onClick={() => {
                setExpanded(false);
                expandButton.current?.focus();
              }}
            >
              Fechar mapa
            </button>
          ) : (
            <button ref={expandButton} onClick={() => setExpanded(true)}>
              Ampliar mapa
            </button>
          )}
        </div>
        <Map
          stations={visible}
          onSelect={onSelect}
          position={position}
          view={view}
          expanded={expanded}
        />
      </div>
      <p className="fine" role="status">
        {status} A posição é usada apenas neste navegador.
      </p>
      <div className="mapcaption">
        <span>● Disponibilidade atualizada a cada 2 segundos</span>
        <span>{stations.length} estações simuladas</span>
      </div>
      <div className="filters" role="group" aria-label="Filtrar estações">
        {[
          ["all", "Todas"],
          ["bikes", "Com bicicletas"],
          ["spaces", "Com vagas"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="stationgrid">
        {visible.map((s) => (
          <button
            className={"station " + (chosen?.id === s.id ? "selected" : "")}
            key={s.id}
            onClick={() => onSelect(s)}
          >
            <img
              className="stationphoto"
              src={s.image}
              alt={s.imageAlt}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="fine">Imagem ilustrativa</span>
            <h3>{s.name}</h3>
            <span className="stationid">
              Estação {String(s.id).padStart(2, "0")}
            </span>
            {position && (
              <p className="fine">
                {formatDistance(distance(position, s))} · em linha reta
              </p>
            )}
            <p>
              <b>{s.available}</b> bikes{" "}
              <span className="muted">/ {s.capacity - s.available} vagas</span>
            </p>
          </button>
        ))}
      </div>
      {!visible.length && (
        <p>
          Nenhuma estação corresponde ao filtro.{" "}
          <button onClick={() => setFilter("all")}>Mostrar todas</button>
        </p>
      )}
    </section>
  );
}
