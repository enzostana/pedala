"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="map placeholder">
      Carregando mapa… A lista de estações continua disponível.
    </div>
  ),
});
export default function Dashboard() {
  const q = useSearchParams();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [code, setCode] = useState(q.get("bike") || ""),
    [chosen, setChosen] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [scan, setScan] = useState(false),
    [time, setTime] = useState(Date.now());
  const boot = useRef(false);
  const active = data?.trips.find((t: any) => !t.ended_at);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/state");
      if (!r.ok) throw Error("Sem conexão com o servidor. Tentando novamente…");
      const state = await r.json();
      setData(state);
      return state;
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  async function action(path: string, body: any = {}) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      await load();
      if (path === "finish") {
        setMessage("Bicicleta devolvida. Obrigado por pedalar!");
        setChosen(null);
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (boot.current) return;
    boot.current = true;
    (async () => {
      const initial = await load();
      if (initial && !initial.demo && q.get("demo") === "1") await action("demo");
    })();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 2000);
    const clock = setInterval(() => setTime(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [load]);
  useEffect(() => {
    if (!scan) return;
    let stopped = false;
    let reader: any;
    import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (stopped) return;
      reader = new Html5Qrcode("scanner");
      try {
        await reader.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (text: string) => {
            let val = text;
            try {
              val = new URL(text).pathname.split("/").pop() || text;
            } catch {}
            setCode(val);
            setScan(false);
          },
          () => {},
        );
        if (stopped) await reader.stop();
      } catch {
        setError("Câmera indisponível. Digite o código impresso no cartão.");
        setScan(false);
      }
    });
    return () => {
      stopped = true;
      if (reader?.isScanning) void reader.stop().catch(() => {});
    };
  }, [scan]);
  const select = useCallback((s: any) => setChosen(s), []);
  const stations = data?.stations || [];
  const duration = (start: string, end?: string) => {
    const sec = Math.max(
      0,
      Math.floor(
        ((end ? new Date(end).getTime() : time) - new Date(start).getTime()) /
          1000,
      ),
    );
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  };
  return (
    <>
      <header>
        <a className="logo" href="/">
          PedaLá<span>●</span>
        </a>
        <nav>
          <a href="/cards">Imprimir QR Codes ↗</a>
          <span className="badge">
            {data?.demo ? "DEMONSTRAÇÃO GUIADA" : "EXPLORAÇÃO LIVRE"}
          </span>
        </nav>
      </header>
      <main className="dashboard">
        <div className="dashintro">
          <div>
            <p className="eyebrow">RIO DE JANEIRO · ESTAÇÕES FICTÍCIAS</p>
            <h1>Bora PedaLá?</h1>
            <p>Seu próximo caminho começa com uma bicicleta.</p>
          </div>
          <div className="actions">
            <button disabled={busy} onClick={() => action("demo")}>
              {data?.demo ? "Reiniciar demo" : "Abrir demo guiada"}
            </button>
            {data?.demo && (
              <button disabled={busy} onClick={() => action("free")}>
                Explorar livremente
              </button>
            )}
          </div>
        </div>
        {error && (
          <div role="alert" className="notice error">
            {error}
            <button
              onClick={() => {
                setError("");
                void load();
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {message && (
          <div role="status" className="notice">
            {message}
          </div>
        )}
        {data?.demo && (
          <div className="guide">
            <b>
              {active
                ? "03 · Acompanhe e devolva"
                : data.trips.length
                  ? "04 · Você completou o percurso!"
                  : "01 · Encontre uma bike → 02 · Escaneie e confirme"}
            </b>
            <span>
              {active
                ? "Escolha abaixo uma estação com vaga para finalizar."
                : "Este cenário é só seu. Use PDL-001 ou escaneie um cartão impresso."}
            </span>
          </div>
        )}
        <div className="workspace">
          <section>
            <Map stations={stations} onSelect={select} />
            <div className="mapcaption">
              <span>● Disponibilidade atualizada a cada 2 segundos</span>
              <span>6 estações simuladas</span>
            </div>
            <div className="stationgrid">
              {stations.map((s: any) => (
                <button
                  className={
                    "station " + (chosen?.id === s.id ? "selected" : "")
                  }
                  key={s.id}
                  onClick={() => setChosen(s)}
                >
                  <span className="stationid">ESTAÇÃO 0{s.id} ↗</span>
                  <h3>{s.name}</h3>
                  <span>
                    <b>{s.available}</b> bikes{" "}
                    <span className="muted">
                      / {s.capacity - s.available} vagas
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <aside>
            {active ? (
              <section className="panel ride">
                <span className="badge">VIAGEM EM ANDAMENTO</span>
                <h2>Boa pedalada!</h2>
                <div className="timer">{duration(active.started_at)}</div>
                <p>Bike {active.bike} · aluguel gratuito</p>
                <p>A trava e o deslocamento são simulados.</p>
                <label htmlFor="destination">Onde você vai devolver?</label>
                <select
                  id="destination"
                  value={chosen?.id || ""}
                  onChange={(e) =>
                    setChosen(
                      stations.find(
                        (s: any) => s.id === Number(e.target.value),
                      ),
                    )
                  }
                >
                  <option value="">Selecione uma estação</option>
                  {stations.map((s: any) => (
                    <option
                      key={s.id}
                      disabled={s.available >= s.capacity}
                      value={s.id}
                    >
                      {s.name} · {s.capacity - s.available} vagas
                    </option>
                  ))}
                </select>
                <button
                  className="btn coral"
                  disabled={
                    busy ||
                    !chosen ||
                    stations.find((s: any) => s.id === chosen.id)?.available >=
                      8
                  }
                  onClick={() =>
                    action("finish", { trip: active.id, station: chosen.id })
                  }
                >
                  Confirmar devolução simulada
                </button>
              </section>
            ) : (
              <section className="panel">
                <p className="eyebrow">SUA PRÓXIMA PEDALADA</p>
                <h2>Escolha sua bike.</h2>
                <p>
                  {chosen
                    ? `Estação ${chosen.name}`
                    : "Escaneie o cartão ou informe o código da bicicleta."}
                </p>
                {chosen && (
                  <div className="bikechips">
                    {chosen.bikes.map((b: string) => (
                      <button key={b} onClick={() => setCode(b)}>
                        {b}
                      </button>
                    ))}
                  </div>
                )}
                <label htmlFor="bike">Código da bicicleta</label>
                <input
                  id="bike"
                  value={code}
                  maxLength={100}
                  placeholder="PDL-001"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button onClick={() => setScan(!scan)}>
                  {scan ? "Fechar câmera" : "▣ Ler QR Code com câmera"}
                </button>
                {scan && <div id="scanner" />}
                <p className="fine">
                  Ao confirmar, você inicia uma viagem gratuita. A liberação da
                  trava é simulada.
                </p>
                <button
                  className="btn coral"
                  disabled={busy || !code}
                  onClick={() => {
                    setMessage("");
                    void action("start", { code: code.trim() });
                  }}
                >
                  Confirmar retirada ↗
                </button>
              </section>
            )}
            <section className="panel history">
              <h3>Suas pedaladas</h3>
              <p className="fine">
                Histórico deste navegador e deste modo de uso.
              </p>
              {data?.trips
                .filter((t: any) => t.ended_at)
                .map((t: any) => (
                  <div className="trip" key={t.id}>
                    <b>{t.bike}</b>
                    <span>
                      {stations.find((s: any) => s.id === t.origin)?.name} →{" "}
                      {stations.find((s: any) => s.id === t.destination)?.name}
                    </span>
                    <small>
                      {duration(t.started_at, t.ended_at)} min · grátis
                    </small>
                  </div>
                ))}
              {!data?.trips.some((t: any) => t.ended_at) && (
                <p>Sua primeira pedalada está por vir.</p>
              )}
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
