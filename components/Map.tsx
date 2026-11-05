"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Station, Position, catalog } from "@/lib/stations";
export default function Map({
  stations,
  onSelect,
  position,
  view,
  expanded,
}: {
  stations: Station[];
  onSelect: (s: Station) => void;
  position: Position | null;
  view: { kind: string; tick: number };
  expanded: boolean;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    markers = useRef<L.LayerGroup | null>(null),
    user = useRef<L.LayerGroup | null>(null);
  const located = useRef(false);
  useEffect(() => {
    if (!el.current) return;
    const u = catalog[6];
    map.current = L.map(el.current).setView([u.lat, u.lng], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    user.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    markers.current?.clearLayers();
    stations.forEach((s) => {
      const label = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = s.name;
      const sub = document.createElement("div");
      sub.textContent = "Estação " + String(s.id).padStart(2, "0");
      label.append(title, sub);
      L.marker([s.lat, s.lng], {
        title: s.name,
        icon: L.divIcon({
          className: "map-pin",
          html: `<b>${s.available}</b>`,
          iconSize: [36, 36],
        }),
      })
        .bindTooltip(label)
        .on("click", () => onSelect(s))
        .addTo(markers.current!);
    });
  }, [stations, onSelect]);
  useEffect(() => {
    user.current?.clearLayers();
    if (!position) return;
    L.circle([position.lat, position.lng], {
      radius: position.accuracy,
      color: "#287de0",
      fillOpacity: 0.08,
      weight: 1,
    }).addTo(user.current!);
    L.circleMarker([position.lat, position.lng], {
      radius: 8,
      color: "#fff",
      weight: 3,
      fillColor: "#287de0",
      fillOpacity: 1,
    })
      .bindTooltip("Você está aqui")
      .addTo(user.current!);
    if (!located.current) {
      map.current?.setView([position.lat, position.lng], 15);
      located.current = true;
    }
  }, [position]);
  useEffect(() => {
    if (view.kind === "all") {
      if (stations.length)
        map.current?.fitBounds(
          L.latLngBounds(stations.map((s) => [s.lat, s.lng])),
          { padding: [35, 35], maxZoom: 15 },
        );
    } else if (view.kind === "user" && position)
      map.current?.setView([position.lat, position.lng], 15);
    else if (view.kind === "uva") {
      const u = catalog[6];
      map.current?.setView([u.lat, u.lng], 15);
    }
  }, [view]);
  useEffect(() => {
    const t = setTimeout(() => map.current?.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [expanded]);
  return (
    <div
      ref={el}
      className="map"
      aria-label="Mapa de estações fictícias no Rio de Janeiro"
    />
  );
}
