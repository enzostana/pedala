"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function Map({
  stations,
  onSelect,
}: {
  stations: any[];
  onSelect: (s: any) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!el.current) return;
    map.current = L.map(el.current).setView([-22.95, -43.195], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    markers.current?.clearLayers();
    stations.forEach((s) =>
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: "map-pin",
          html: `<b>${s.available}</b>`,
          iconSize: [36, 36],
        }),
      })
        .bindTooltip(s.name)
        .on("click", () => onSelect(s))
        .addTo(markers.current!),
    );
  }, [stations, onSelect]);
  return (
    <div
      ref={el}
      className="map"
      aria-label="Mapa de estações fictícias no Rio de Janeiro"
    />
  );
}
