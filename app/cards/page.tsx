import QRCode from "qrcode";
export default async function Cards() {
  const cards = await Promise.all(
    Array.from({ length: 28 }, async (_, i) => {
      const code = `PDL-${String(i + 1).padStart(3, "0")}`;
      const url = `${process.env.PUBLIC_URL || "https://pedala.enzostana.space"}/bikes/${code}`;
      return {
        code,
        url,
        image: await QRCode.toDataURL(url, {
          width: 280,
          margin: 4,
          errorCorrectionLevel: "M",
        }),
      };
    }),
  );
  return (
    <main className="cardsPage">
      <div className="noprint">
        <a href="/app">← Voltar às estações</a>
        <h1>Um cartão. Uma bicicleta.</h1>
        <p>
          Imprima esta página pelo navegador. Escaneie um QR para identificar a
          bicicleta e confirme a retirada no site.
        </p>
        <p>
          Em exploração livre, cada bike pode estar disponível ou em uso. Na
          demo reiniciada, PDL-001 está disponível.
        </p>
      </div>
      <div className="cards">
        {cards.map((c) => (
          <article className="qrcard" key={c.code}>
            <h2>PedaLá ↗</h2>
            <img
              src={c.image}
              alt={`QR Code da bicicleta ${c.code}`}
              width="200"
              height="200"
            />
            <h3>{c.code}</h3>
            <p>Escaneie. Confirme. PedaLe.</p>
            <small>{c.url}</small>
            <p className="fine">Simulação acadêmica · aluguel gratuito</p>
          </article>
        ))}
      </div>
    </main>
  );
}
