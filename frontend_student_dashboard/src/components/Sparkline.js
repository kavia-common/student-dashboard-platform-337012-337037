import React, { useMemo } from "react";

/**
 * Small SVG sparkline for compact trend visualization.
 * No external dependencies; intended for dashboard widgets.
 */

// PUBLIC_INTERFACE
export function Sparkline({
  series,
  width = 260,
  height = 64,
  stroke = "var(--primary)",
  fill = "rgba(59,130,246,0.12)",
  strokeWidth = 2,
  ariaLabel = "Trend chart",
}) {
  /** Render a compact sparkline for a [{label, value}] series. */
  const points = useMemo(() => {
    const s = Array.isArray(series) ? series : [];
    if (s.length === 0) return { d: "", area: "", min: 0, max: 0, last: 0 };

    const values = s.map((p) => Number(p.value ?? 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const pad = 6;
    const innerW = Math.max(1, width - pad * 2);
    const innerH = Math.max(1, height - pad * 2);

    const xy = values.map((v, i) => {
      const x = pad + (i * innerW) / Math.max(1, values.length - 1);
      // y: invert (svg origin at top)
      const y = pad + (1 - (v - min) / span) * innerH;
      return { x, y, v };
    });

    const d = xy
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");

    // Area path to baseline (bottom padding)
    const baseY = pad + innerH;
    const area = `${d} L ${xy[xy.length - 1].x.toFixed(2)} ${baseY.toFixed(
      2
    )} L ${xy[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`;

    return { d, area, min, max, last: values[values.length - 1] };
  }, [series, width, height]);

  const hasData = Boolean(points.d);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block" }}
    >
      {hasData ? (
        <>
          <path d={points.area} fill={fill} />
          <path
            d={points.d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* last point */}
          <circle
            cx={width - 6}
            cy={Math.max(6, Math.min(height - 6, height / 2))}
            r="0"
            fill="transparent"
          />
        </>
      ) : (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(17,24,39,0.45)"
          style={{ fontSize: 12 }}
        >
          No data
        </text>
      )}
    </svg>
  );
}

export default Sparkline;
