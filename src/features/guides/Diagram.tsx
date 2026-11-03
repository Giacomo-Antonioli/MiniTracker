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
          ['Layer', 'thin milk', 0.7],
          ['Glaze', 'coloured water', 0.3],
        ].map(([label, like, a], i) => (
          <g key={label as string} transform={`translate(${12 + i * 78},14)`}>
            <rect width="66" height="56" rx="6" fill="#e8e2d0" />
            <rect width="66" height="56" rx="6" fill="#b2423a" opacity={a as number} />
            <text x="33" y="82" textAnchor="middle" fill={ink} fontSize="11" fontWeight="600">{label}</text>
            <text x="33" y="97" textAnchor="middle" fill={ink} fontSize="8" opacity="0.7">like {like}</text>
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
        <text x="120" y="100" textAnchor="middle" fill="#1b1e24" fontSize="10">raised areas keep only a thin film</text>
        <text x="120" y="12" textAnchor="middle" fill={ink} fontSize="10">shade pools in the recesses</text>
        <path d="M95,15 L85,58 M145,15 L185,58" stroke={ink} strokeWidth="1" opacity="0.6" />
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
        <text x="20" y="96" fill={ink} fontSize="10">dark</text>
        <text x="220" y="96" textAnchor="end" fill={ink} fontSize="10">light</text>
        <text x="120" y="12" textAnchor="middle" fill={ink} fontSize="10">work the join while both are wet</text>
      </>
    ),
  },
  spray: {
    caption: 'Spraying: 25–30 cm away, short passes that start and end off the model.',
    svg: <Spray label="primer" />,
  },
  varnish: {
    caption: 'Varnish like primer: dry paint, 25–30 cm, light passes; gloss on gems and lenses last.',
    svg: <Spray label="varnish" />,
  },
  contrast: {
    caption: 'Contrast over a light undercoat: dark where it pools, light where it thins.',
    svg: (
      <>
        <rect x="14" y="20" width="96" height="70" rx="6" fill="#e8e2d0" />
        <text x="62" y="106" textAnchor="middle" fill={ink} fontSize="10">light primer</text>
        <text x="120" y="60" textAnchor="middle" fill={ink} fontSize="16">→</text>
        <defs>
          <radialGradient id="dg-contrast" cx="0.5" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#5f8fd0" />
            <stop offset="0.7" stopColor="#24457a" />
            <stop offset="1" stopColor="#0e1d38" />
          </radialGradient>
        </defs>
        <rect x="130" y="20" width="96" height="70" rx="6" fill="url(#dg-contrast)" />
        <text x="178" y="106" textAnchor="middle" fill={ink} fontSize="10">one coat of Contrast</text>
      </>
    ),
  },
  stipple: {
    caption: 'Stippling: dab straight down; dots get denser towards the highlight.',
    svg: (
      <>
        <rect x="10" y="14" width="220" height="80" rx="6" fill="#5a3a24" />
        {Array.from({ length: 260 }, (_, i) => {
          // Fixed pseudo-random dots, more of them towards the right (the highlight).
          const r = (n: number) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1
          const x = 14 + Math.sqrt(r(1)) * 212
          const y = 18 + r(2) * 72
          return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="1.6" fill="#c79a6b" />
        })}
        <text x="40" y="108" fill={ink} fontSize="10">sparse</text>
        <text x="200" y="108" textAnchor="end" fill={ink} fontSize="10">dense = highlight</text>
      </>
    ),
  },
  chips: {
    caption: 'Chipping: damage on edges and corners, with a thin light line under each chip.',
    svg: (
      <>
        <rect x="30" y="20" width="180" height="76" rx="4" fill="#2f5aa8" />
        {[[34, 24, 10, 5], [70, 21, 7, 4], [190, 24, 14, 6], [205, 60, 4, 10], [34, 82, 12, 8], [120, 92, 9, 3]].map(([x, y, w, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx="2" fill="#3a2a1e" />
            <path d={`M${x},${y + h + 1} h${w}`} stroke="#9cc2f5" strokeWidth="1.2" />
          </g>
        ))}
        <text x="120" y="62" textAnchor="middle" fill="#dfe8f7" fontSize="10">flat panels stay clean</text>
      </>
    ),
  },
  lens: {
    caption: 'Lens or gem: dark top, light bottom, then a white dot on the dark side.',
    svg: (
      <>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${20 + i * 75},14)`}>
            <defs>
              <linearGradient id={`dg-lens${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4a0a0a" />
                <stop offset="1" stopColor={i === 0 ? '#4a0a0a' : '#ff6a3a'} />
              </linearGradient>
            </defs>
            <circle cx="30" cy="34" r="26" fill={`url(#dg-lens${i})`} stroke="#222" strokeWidth="2" />
            {i === 2 && <circle cx="20" cy="24" r="4" fill="#fff" />}
            <text x="30" y="80" textAnchor="middle" fill={ink} fontSize="10">{['1. dark', '2. light below', '3. white dot'][i]}</text>
          </g>
        ))}
      </>
    ),
  },
  freehand: {
    caption: 'Freehand: sketch thin and light, fill, then tidy edges with the base colour.',
    svg: (
      <>
        {['sketch', 'fill', 'tidy'].map((label, i) => (
          <g key={label} transform={`translate(${12 + i * 76},12)`}>
            <path d="M8,6 h56 v48 q-28,26 -56,0 z" fill="#1d1d1d" stroke="#555" />
            {i === 0 && <path d="M36,16 l14,24 h-28 z" fill="none" stroke="#bbb" strokeWidth="1.5" />}
            {i === 1 && <path d="M36,15 l15,26 h-30 z" fill="#d23a2a" stroke="#d23a2a" strokeWidth="2" strokeLinejoin="round" />}
            {i === 2 && <path d="M36,16 l14,24 h-28 z" fill="#d23a2a" />}
            <text x="36" y="96" textAnchor="middle" fill={ink} fontSize="10">{`${i + 1}. ${label}`}</text>
          </g>
        ))}
      </>
    ),
  },
  weathering: {
    caption: 'Weathering: rust streaks run down from bolts and edges; mud and dust gather low.',
    svg: (
      <>
        <rect x="40" y="10" width="160" height="96" fill="#7d8a6a" />
        {[70, 120, 170].map((x) => (
          <g key={x}>
            <circle cx={x} cy="22" r="4" fill="#4d5544" />
            <path d={`M${x - 2},26 q2,20 0,40 M${x + 2},26 q-1,14 1,26`} stroke="#8a4a22" strokeWidth="2" opacity="0.7" fill="none" />
          </g>
        ))}
        <path d="M40,106 L40,84 q20,-8 40,2 q20,-10 40,0 q20,-8 40,2 q20,-8 40,0 L200,106 Z" fill="#5b4632" />
        <text x="220" y="28" fill={ink} fontSize="9">rust</text>
        <text x="204" y="100" fill={ink} fontSize="9">mud</text>
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

function Spray({ label }: { label: string }) {
  return (
    <>
      <rect x="14" y="40" width="34" height="56" rx="6" fill="#888" />
      <rect x="24" y="30" width="14" height="12" fill="#555" />
      <path d="M44,40 L200,22 L200,98 Z" fill="#e8e2d0" opacity="0.15" />
      <path d="M200,40 q14,-10 18,8 v40 q-4,10 -18,6 z" fill="#c9c3b2" />
      <path d="M52,108 H196" stroke={ink} strokeWidth="1" />
      <path d="M52,104 v8 M196,104 v8" stroke={ink} strokeWidth="1" />
      <text x="124" y="104" textAnchor="middle" fill={ink} fontSize="10">25–30 cm</text>
      <text x="124" y="16" textAnchor="middle" fill={ink} fontSize="10">{`short passes of ${label}, past the model ↕`}</text>
    </>
  )
}
