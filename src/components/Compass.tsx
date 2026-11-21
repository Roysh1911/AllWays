import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from './theme';

type Props = {
  /** Phone heading from true north, degrees. null = no compass sensor available. */
  heading: number | null;
  /** Bearing to the partner from true north, degrees. null = no location yet. */
  bearing: number | null;
  stale: boolean;
  /** So close that direction is meaningless: show a heart in the middle instead of the needle. */
  nearby?: boolean;
  size?: number;
};

const C = 150; // viewBox centre
const HEART =
  'M150 76 C 150 76, 132 62, 132 50 C 132 42, 138 37, 144 37 C 147.5 37, 149.3 39, 150 41 C 150.7 39, 152.5 37, 156 37 C 162 37, 168 42, 168 50 C 168 62, 150 76, 150 76 Z';

/** Dial turns with the world (north stays north); the heart needle points at the partner. */
export function Compass({ heading, bearing, stale, nearby = false, size = 300 }: Props) {
  const h = heading ?? 0;
  const needleColor = stale ? colors.stale : colors.accent;
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);

  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      <Circle cx={C} cy={C} r={142} fill={colors.card} stroke={colors.line} strokeWidth={2} />

      {/* Dial: rotated by -heading so its N mark points to real north. */}
      <G rotation={-h} origin={`${C}, ${C}`}>
        {ticks.map((deg) => {
          const major = deg % 90 === 0;
          const mid = deg % 30 === 0;
          const len = major ? 14 : mid ? 9 : 4;
          return (
            <Line
              key={deg}
              x1={C}
              y1={14}
              x2={C}
              y2={14 + len}
              stroke={major ? colors.ink : colors.muted}
              strokeWidth={major ? 2.5 : 1}
              rotation={deg}
              origin={`${C}, ${C}`}
            />
          );
        })}
        <SvgText x={C} y={48} fontSize={18} fontWeight="700" fill={colors.accent} textAnchor="middle">
          N
        </SvgText>
      </G>

      {/* Needle toward the partner, relative to where the phone points. */}
      {bearing !== null && !nearby && (
        <G rotation={bearing - h} origin={`${C}, ${C}`}>
          <Line x1={C} y1={C + 34} x2={C} y2={70} stroke={needleColor} strokeWidth={6} strokeLinecap="round" />
          {/* Heart at the tip */}
          <Path
            d={HEART}
            fill={needleColor}
          />
        </G>
      )}

      {nearby ? (
        // Same heart as the needle tip, scaled ×2.5 around the centre.
        <G transform="translate(150 150) scale(2.5) translate(-150 -56)">
          <Path d={HEART} fill={needleColor} />
        </G>
      ) : (
        <>
          <Circle cx={C} cy={C} r={10} fill={colors.ink} />
          <Circle cx={C} cy={C} r={4} fill={colors.card} />
        </>
      )}
    </Svg>
  );
}
