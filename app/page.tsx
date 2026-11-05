import Bike from "@/components/Bike";
export default function Home() {
  return (
    <>
      <header>
        <a className="logo" href="/">
          PedaLá<span>●</span>
        </a>
        <nav>
          <a href="#como">Como funciona</a>
          <a href="/cards">QR Codes</a>
          <a className="smallbtn" href="/app">
            Encontrar uma bike ↗
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">DUAS RODAS. MIL POSSIBILIDADES.</p>
            <h1>
              O Rio é seu.
              <br />
              Vai de <em>PedaLá.</em>
            </h1>
            <p className="lead">
              Troque a pressa por uma pedalada. Encontre uma bike, descubra
              outro caminho e aproveite a cidade no seu ritmo.
            </p>
            <div className="actions">
              <a className="btn coral" href="/app?demo=1">
                Experimentar agora ↗
              </a>
              <a className="textlink" href="/app">
                Explorar estações →
              </a>
            </div>
            <p className="fine">
              Sem cadastro. Sem cobrança. Uma experiência acadêmica interativa.
            </p>
          </div>
          <div className="art">
            <span className="artlabel">FEITO PARA EXPLORAR</span>
            <Bike />
            <span className="sticker">
              Menos trânsito.
              <br />
              Mais horizonte. ✳
            </span>
            <div className="artbottom">
              <span>RIO DE JANEIRO</span>
              <span>22°54′ S · 43°12′ O</span>
            </div>
          </div>
        </section>
        <div className="ribbon">
          UM NOVO JEITO DE IR &nbsp; ✳ &nbsp; MAIS CIDADE, MENOS PRESSA &nbsp; ✳
          &nbsp; PEDALE POR AÍ &nbsp; ✳ &nbsp; UM NOVO JEITO DE IR
        </div>
        <section id="como" className="how">
          <p className="eyebrow">SIMPLES ASSIM</p>
          <h2>
            Da vontade de sair
            <br />à primeira pedalada.
          </h2>
          <div className="steps">
            {[
              [
                "01",
                "Encontre seu ponto",
                "Veja as estações no mapa e escolha uma bicicleta disponível.",
              ],
              [
                "02",
                "Escaneie e confirme",
                "Leia o QR Code impresso ou digite o código da bike. A liberação é simulada.",
              ],
              [
                "03",
                "PedaLe por aí",
                "Acompanhe sua viagem e devolva em qualquer estação com vaga.",
              ],
            ].map(([n, t, d]) => (
              <article key={n}>
                <span className="number">{n} ↗</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="callout">
          <div>
            <p className="eyebrow">DA TEORIA PARA A PRÁTICA</p>
            <h2>
              Uma cidade conectada.
              <br />
              Uma demo de verdade.
            </h2>
            <p>
              Retiradas e devoluções atualizam a disponibilidade entre telas.
              Tudo com bicicletas e estações fictícias.
            </p>
          </div>
          <a className="btn coral" href="/app?demo=1">
            Começar demonstração ↗
          </a>
        </section>
      </main>
    </>
  );
}
