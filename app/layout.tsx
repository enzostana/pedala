import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "PedaLá — seu próximo caminho começa aqui",
  description:
    "Explore o Rio sobre duas rodas. Demonstração acadêmica de bicicletas compartilhadas.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <footer>
          <a href="/">PedaLá ↗</a>
          <span>Projeto acadêmico · estações e travas simuladas</span>
          <a href="https://github.com/enzostana/pedala">Código aberto ↗</a>
        </footer>
      </body>
    </html>
  );
}
