export default function Bike() {
  return (
    <svg
      viewBox="0 0 640 420"
      role="img"
      aria-label="Ilustração de bicicleta PedaLá"
    >
      <circle
        cx="170"
        cy="280"
        r="100"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
      />
      <circle
        cx="490"
        cy="280"
        r="100"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
      />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinejoin="round"
      >
        <path d="M170 280L250 120L350 280H170L290 170H445L490 280M350 280L290 170M445 170L420 85H470M220 120H285" />
      </g>
      <circle cx="350" cy="280" r="19" fill="#ff8768" />
      <path
        d="M350 280L380 310H400"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
      />
    </svg>
  );
}
