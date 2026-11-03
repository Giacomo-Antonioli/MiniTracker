import type { DiagramId } from '../../domain/guides/techniqueDetails'

/** Small explanatory drawings for technique guides, drawn for MiniTracker. They use the page's colours. */
export function Diagram({ id }: { id: DiagramId }) {
  const d = DIAGRAMS[id]
  return (
    <figure className="grid gap-1">
      <svg viewBox="0 0 240 120" className="w-full rounded border border-line bg-black/20" role="img" aria-label={d.caption}>
        {d.svg}
      </svg>
      <figcaption className="text-xs text-muted">{d.caption}</figcaption>
    </figure>
  )
}

const ink = 'currentColor'
const DIAGRAMS: Record<DiagramId, { caption: string; svg: React.ReactNode }> = {
  light: {
    caption: 'Light from above: tops are brightest, undersides stay dark.',
    svg: (
      <>
        <defs>
          <linearGradient id="dg-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2f2f2" />
            <stop offset="0.5" stopColor="#7a7a7a" />
            <stop offset="1" stopColor="#151515" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="72" r="40" fill="url(#dg-light)" />
        {[90, 120, 150].map((x) => <line key={x} x1={x} y1="6" x2={x} y2="24" stroke="#e8c15a" strokeWidth="2" markerEnd="url(#dg-arrow)" />)}
        <defs>
          <marker id="dg-arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#e8c15a" /></marker>
        </defs>
        <text x="172" y="50" fill={ink} fontSize="10">highlight</text>
        <text x="172" y="78" fill={ink} fontSize="10">mid-tone</text>
        <text x="172" y="106" fill={ink} fontSize="10">shadow</text>
      </>
    ),
  },
  consistency: {
    caption: 'Paint consistency: thicker for basecoats, thinner for layers, very thin for glazes.',
    svg: (
      <>
        {[
          ['Basecoat', 'milk', 0.95],
          ['Layer', 'skimmed milk', 0.7],
          ['Glaze', 'tinted water', 0.3],
        ].map(([label, like, a], i) => (
          <g key={label as string} transform={`translate(${12 + i * 78},14)`}>
            <rect width="66" height="56" rx="6" fill="#b2423a" opacity={a as number} />
            <text x="33" y="82" textAnchor="middle" fill={ink} fontSize="11" fontWeight="600">{label}</text>
            <text x="33" y="97" textAnchor="middle" fill={ink} fontSize="9" opacity="0.7">like {like}</text>
          </g>
        ))}
      </>
    ),
  },
  wash: {
    caption: 'Cross-section: shade runs off raised areas and collects in the recesses.',
    svg: (
      <>
        <path d="M10,40 L60,40 L70,80 L100,80 L110,40 L160,40 L170,80 L200,80 L210,40 L230,40 L230,110 L10,110 Z" fill="#8a8f98" />
        <path d="M66,64 L70,80 L100,80 L104,64 Z M166,64 L170,80 L200,80 L204,64 Z" fill="#2a2f3a" />
        <path d="M10,40 L60,40 M110,40 L160,40 M210,40 L230,40" stroke="#2a2f3a" strokeWidth="1.5" opacity="0.4" />
        <text x="85" y="30" textAnchor="middle" fill={ink} fontSize="10">recess: shade pools here</text>
        <text x="35" y="30" textAnchor="middle" fill={ink} fontSize="10">thin</text>
      </>
    ),
  },
  layers: {
    caption: 'Layering: each lighter layer covers a smaller area, towards the light.',
    svg: (
      <>
        <ellipse cx="120" cy="66" rx="100" ry="46" fill="#1f3c73" />
        <ellipse cx="120" cy="56" rx="72" ry="32" fill="#2f5aa8" />
        <ellipse cx="120" cy="46" rx="44" ry="18" fill="#4f82d6" />
        <ellipse cx="120" cy="38" rx="18" ry="7" fill="#9cc2f5" />
        <text x="226" y="104" textAnchor="end" fill={ink} fontSize="9">base</text>
        <text x="200" y="76" textAnchor="end" fill={ink} fontSize="9">layer 1</text>
        <text x="172" y="54" textAnchor="end" fill={ink} fontSize="9">layer 2</text>
      </>
    ),
  },
  edge: {
    caption: 'Edge highlight: lay the side of the bristles on the edge and drag along it.',
    svg: (
      <>
        <path d="M20,100 L120,40 L220,100 Z" fill="#7a1f1f" />
        <path d="M20,100 L120,40" stroke="#f0a090" strokeWidth="3" />
        <g transform="rotate(-31 80 64)">
          <rect x="40" y="48" width="70" height="8" rx="4" fill="#c9a96e" />
          <path d="M110,46 L140,52 L110,58 Z" fill="#3a2a1a" />
        </g>
        <text x="150" y="30" fill={ink} fontSize="10">side of the brush</text>
        <text x="150" y="44" fill={ink} fontSize="10">→ thin bright line</text>
      </>
    ),
  },
  drybrush: {
    caption: 'Drybrush: an almost dry brush only touches the raised texture.',
    svg: (
      <>
        <path d="M10,90 Q25,60 40,90 Q55,55 70,90 Q85,62 100,90 Q115,52 130,90 Q145,60 160,90 Q175,56 190,90 Q205,62 230,90 L230,112 L10,112 Z" fill="#4a3a2a" />
        <path d="M22,72 Q25,66 30,72 M50,68 Q55,58 60,68 M80,72 Q85,64 90,72 M110,66 Q115,54 120,66 M140,70 Q145,62 150,70 M170,68 Q175,58 180,68" stroke="#d8c39a" strokeWidth="3" fill="none" />
        <rect x="70" y="14" width="80" height="14" rx="3" fill="#c9a96e" />
        <rect x="150" y="12" width="24" height="18" rx="2" fill="#888" />
        <path d="M70,16 L44,22 L70,26 Z" fill="#3a2a1a" />
        <text x="120" y="48" textAnchor="middle" fill={ink} fontSize="10">flick lightly across ↔</text>
      </>
    ),
  },
  glaze: {
    caption: 'Glazing: several see-through coats slowly shift and smooth the colour.',
    svg: (
      <>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={20 + i * 52} y="20" width="44" height="70" fill="#b0b0b0" />
            {Array.from({ length: i }, (_, j) => <rect key={j} x={20 + i * 52} y="20" width="44" height="70" fill="#7a3fa0" opacity="0.28" />)}
            <text x={42 + i * 52} y="106" textAnchor="middle" fill={ink} fontSize="10">{i === 0 ? 'before' : `${i} coat${i > 1 ? 's' : ''}`}</text>
          </g>
        ))}
      </>
    ),
  },
  blend: {
    caption: 'Wet blending: two wet colours worked together into a smooth gradient.',
    svg: (
      <>
        <defs>
          <linearGradient id="dg-blend" x1="0" x2="1">
            <stop offset="0" stopColor="#123f6b" />
            <stop offset="0.35" stopColor="#123f6b" />
            <stop offset="0.65" stopColor="#7fb6e8" />
            <stop offset="1" stopColor="#7fb6e8" />
          </linearGradient>
        </defs>
        <rect x="16" y="20" width="208" height="56" rx="6" fill="url(#dg-blend)" />
        <text x="40" y="96" fill={ink} fontSize="10">dark</text>
        <text x="120" y="96" textAnchor="middle" fill={ink} fontSize="10">work the join while wet</text>
        <text x="200" y="96" textAnchor="end" fill={ink} fontSize="10">light</text>
      </>
    ),
  },
  order: {
    caption: 'Basing order: texture → shade → drybrush → rim → tufts.',
    svg: (
      <>
        {['texture', 'shade', 'drybrush', 'rim', 'tufts'].map((s, i) => (
          <g key={s} transform={`translate(${8 + i * 46},30)`}>
            <ellipse cx="20" cy="30" rx="19" ry="9" fill={i === 3 ? '#111' : '#5a4630'} stroke={i >= 3 ? '#111' : 'none'} strokeWidth="3" />
            <ellipse cx="20" cy="26" rx="17" ry="7" fill={['#6b5538', '#4a3826', '#8c7352', '#8c7352', '#8c7352'][i]} />
            {i === 4 && <path d="M14,22 l2,-8 l2,8 M22,22 l2,-9 l2,9" stroke="#6f9a3a" strokeWidth="2" />}
            <text x="20" y="58" textAnchor="middle" fill={ink} fontSize="9">{s}</text>
          </g>
        ))}
      </>
    ),
  },
}
