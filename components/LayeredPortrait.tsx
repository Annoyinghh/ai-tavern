import { useId } from 'react';
import { appearanceFor, outfitWidth, portraitColors } from '@/lib/appearance';

type Layers = NonNullable<ReturnType<typeof appearanceFor>>;

export default function LayeredPortrait({ layers, name, thumbnail, className }: {
  layers: Layers;
  name?: string;
  thumbnail?: boolean;
  className?: string;
}) {
  const id = useId();
  const { fit, body, bodyStyle, skin, hair, outfit, outfitColor } = layers;
  const feature = 'feature' in layers ? layers.feature : undefined;
  const female = bodyStyle === 'female';
  const width = outfitWidth[fit];
  const left = 160 - width;
  const right = 160 + width;
  const low = fit === 'short' ? 21 : 0;
  const jaw = fit === 'broad' ? (female ? 29 : 35) : female ? 21 : 28;
  const color = portraitColors[outfitColor];
  const fabric = `url(#${id}-fabric)`;
  const dark = '#261f25';
  const stitch = '#e5be87';
  return (
    <svg viewBox={thumbnail ? '58 24 204 204' : '0 0 320 410'} preserveAspectRatio="xMidYMax meet" className={className}
      role={name ? 'img' : undefined} aria-label={name} aria-hidden={name ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-skin`} x2="0.85" y2="0.7">
          <stop stopColor={skin} /><stop offset="1" stopColor={skin} stopOpacity=".65" />
        </linearGradient>
        <linearGradient id={`${id}-fabric`} x1=".12" x2=".88" y2=".82">
          <stop stopColor={color} /><stop offset="1" stopColor="#292332" />
        </linearGradient>
      </defs>
      <g transform={`translate(0 ${low})`} stroke={dark} strokeWidth="2.5" strokeLinejoin="round">
        {/* Person and underlayer, shared by every outfit. */}
        {female && feature !== 'dragon' && <path fill={hair} d="M110 81Q123 36 164 37Q208 41 211 89L221 175Q185 199 101 175Z" />}
        <path fill={skin} d="M145 124H175L179 155L194 164L160 193L126 164L141 155Z" />
        <path fill="#55424a" d={`M139 152Q160 174 181 152L${right - 16} 174Q${right} 184 ${right + 4} 210L${right + 9} 403H${left - 9}L${left - 4} 210Q${left} 184 ${left + 16} 174Z`} />
        <path fill={skin} d="M122 89Q103 79 108 101L121 114M198 89Q217 79 212 101L199 114" />
        {(feature === 'elf' || feature === 'fins') && <path fill={skin} d="M124 93L89 72Q98 103 122 116M197 93L231 72Q222 103 198 116" />}
        {(feature === 'horns' || feature === 'dragon') && <path fill="#ad835f" d={feature === 'dragon' && female
          ? 'M123 66Q98 59 105 31Q114 48 135 47M197 66Q222 59 215 31Q206 48 185 47'
          : 'M123 67Q100 65 94 26Q114 45 137 47M197 67Q220 65 226 26Q206 45 183 47'} />}
        <path fill={dark} d={`M116 80Q118 43 160 43Q202 43 204 80L198 114L${160 + jaw} 131Q160 155 ${160 - jaw} 131L122 114Z`} />
        <path fill={`url(#${id}-skin)`} d={`M116 80Q118 43 160 43Q202 43 204 80L198 114L${160 + jaw} 131Q160 155 ${160 - jaw} 131L122 114Z`} />
        {feature === 'dragon'
          ? <path fill={skin} d="M130 109L147 101H173L190 109L184 128Q160 141 136 128Z" />
          : <path fill={hair} d={female
            ? 'M113 96Q105 69 123 48Q142 28 169 37Q214 36 207 99L194 74Q163 78 149 55Q139 78 116 86Z'
            : 'M114 93Q103 73 117 49Q140 27 167 36L193 39L210 64L205 91L191 65Q168 72 148 57Q137 75 118 80Z'} />}
        <path fill="none" stroke={hair} d="M127 88Q137 82 148 88M172 88Q182 82 193 88" />
        <path fill="#f8e2c2" strokeWidth="1.5" d="M128 96Q138 89 148 95Q138 101 128 96ZM172 95Q182 89 192 96Q182 101 172 95Z" />
        <path fill={dark} stroke="none" d="M136 92h5v7h-5zM179 92h5v7h-5z" />
        <path fill="none" stroke="#764e4c" strokeWidth="1.5" d="M159 96l-4 16 8 1M149 124q11 5 22-1" />
        {body === '矮人' && !female && <path fill={hair} d="M121 107Q138 123 149 119Q160 129 171 119Q182 123 199 107L189 142L160 162L131 142Z" />}
        {feature === 'orc' && <path fill="#eee0b8" strokeWidth="1.3" d="M145 127l-9-12 1 16m38-4 9-12-1 16" />}
        {feature === 'mark' && <path fill="none" stroke="#8450a7" strokeWidth="1.4" d="M160 69l-5 8 5 5 5-5Z" />}
        {feature === 'scar' && <path fill="none" stroke="#935849" strokeWidth="1.4" d="M185 99l-9 14m4-11 6 4" />}
        <path fill="none" stroke="#f9e4be" strokeWidth="1" opacity=".55" d="M118 67q8-20 25-24m-27 68 5 3m69-2 6-10" />

        {/* Clothing is measured against the body's shoulder and neck anchors. */}
        <path fill={fabric} d={`M137 153L${left + 12} 169Q${left - 1} 176 ${left - 5} 207L${left - 16} 390Q160 405 ${right + 16} 390L${right + 5} 207Q${right + 1} 176 ${right - 12} 169L183 153L160 182Z`} />
        {outfit === 'cloak' && <>
          <path fill={fabric} d={`M135 151Q${left + 16} 148 ${left} 180L${left - 16} 378L111 393L147 182Z M185 151Q${right - 16} 148 ${right} 180L${right + 16} 378L212 393L173 182Z`} />
          <path fill="none" stroke={stitch} strokeWidth="1.5" d={`M${left + 7} 191L${left - 5} 365M${right - 7} 191L${right + 5} 365M118 168l32 19h20l32-19`} />
          <circle cx="160" cy="187" r="10" fill="#c49353" /><path fill="#382736" d="M160 180l5 7-5 7-5-7Z" />
        </>}
        {outfit === 'robe' && <>
          <path fill="#382d43" d={`M137 154L176 210L149 385H114L145 215L126 174Z M183 154L196 174L171 211L195 385H161L147 207Z`} />
          <path fill="none" stroke={stitch} strokeWidth="1.8" d={`M137 155l38 55-27 171m35-226-37 52 15 174M${left + 6} 346l22 3m${2 * width - 56} 0 22-3`} />
          <path fill={stitch} d="M160 221l7 14-7 14-7-14Z" /><path fill="#352c42" d="M111 254h98v13h-98Z" />
        </>}
        {outfit === 'armor' && <>
          <path fill="#a9a9ae" d={`M${left + 10} 169L126 159L135 191L${left + 4} 215L${left - 12} 196Z M${right - 10} 169L194 159L185 191L${right - 4} 215L${right + 12} 196Z`} />
          <path fill="#777985" d="M129 175L160 189L191 175L200 245L185 280H135L120 245Z" />
          <path fill={color} d="M145 183l15 9 15-9 9 183-24 17-24-17Z" />
          <path fill={stitch} d="M157 217h6v15h10v6h-10v22h-6v-22h-10v-6h10Z" />
          <path fill="#523637" d="M117 267h86v14h-86Z" /><path fill="#c0a172" d="M148 267h24v14h-24Z" />
        </>}
        {outfit === 'coat' && <>
          <path fill="#f0dcc4" d="M137 152l23 26 23-26-13 122h-20Z" />
          <path fill="#713e45" d="M153 181h14l-3 10 6 49-10 13-10-13 6-49Z" />
          <path fill={color} d="M137 152l20 124-36-57 8-15-15-14Z M183 152l-20 124 36-57-8-15 15-14Z" />
          <path fill="none" stroke={stitch} strokeWidth="1.5" d="M101 240l24 5m70 0 24-5M160 275l-2 109" />
          <circle cx="167" cy="291" r="3" fill={stitch} /><circle cx="167" cy="313" r="3" fill={stitch} />
        </>}
      </g>
    </svg>
  );
}
