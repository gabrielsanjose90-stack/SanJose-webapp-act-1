import React from 'react';

interface RadarProps {
  flexibility: number;
  stamina: number;
  speed: number;
  strength: number;
}

export const AttributeRadarChart: React.FC<RadarProps> = ({ flexibility, stamina, speed, strength }) => {
  const cx = 130;
  const cy = 120;
  const maxR = 82;

  const axes = [
    { label: 'Flexibility', value: flexibility, angle: -Math.PI / 2, tx: cx, ty: cy - maxR - 16, anchor: 'middle' as const },
    { label: 'Speed', value: speed, angle: 0, tx: cx + maxR + 12, ty: cy + 4, anchor: 'start' as const },
    { label: 'Stamina', value: stamina, angle: Math.PI / 2, tx: cx, ty: cy + maxR + 22, anchor: 'middle' as const },
    { label: 'Strength', value: strength, angle: Math.PI, tx: cx - maxR - 12, ty: cy + 4, anchor: 'end' as const },
  ];

  const ringLevels = [0.25, 0.5, 0.75, 1];

  const pointsString = axes
    .map((ax) => {
      const r = (Math.max(10, Math.min(100, ax.value)) / 100) * maxR;
      const x = cx + Math.cos(ax.angle) * r;
      const y = cy + Math.sin(ax.angle) * r;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="w-full flex flex-col items-center">
      <svg viewBox="0 0 260 245" className="w-full max-w-[280px] h-auto" role="img" aria-label="Physical Conditioning Radar Chart">
        {ringLevels.map((lvl) => {
          const ringPts = axes
            .map((ax) => {
              const r = lvl * maxR;
              return `${(cx + Math.cos(ax.angle) * r).toFixed(1)},${(cy + Math.sin(ax.angle) * r).toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={lvl}
              points={ringPts}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={lvl === 1 ? '1.2' : '0.8'}
              strokeDasharray={lvl < 1 ? '2 2' : undefined}
            />
          );
        })}

        {axes.map((ax) => (
          <line
            key={ax.label}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(ax.angle) * maxR}
            y2={cy + Math.sin(ax.angle) * maxR}
            stroke="#D1D5DB"
            strokeWidth="1"
          />
        ))}

        <polygon
          points={pointsString}
          fill="rgba(200, 30, 43, 0.14)"
          stroke="#C81E2B"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {axes.map((ax) => {
          const r = (Math.max(10, Math.min(100, ax.value)) / 100) * maxR;
          const px = cx + Math.cos(ax.angle) * r;
          const py = cy + Math.sin(ax.angle) * r;
          return (
            <g key={ax.label}>
              <circle cx={px} cy={py} r="4" fill="#C81E2B" stroke="#FFFFFF" strokeWidth="1.5" />
              <text
                x={ax.tx}
                y={ax.ty}
                textAnchor={ax.anchor}
                className="fill-[#111317] text-[11px] font-semibold"
              >
                {ax.label}
              </text>
              <text
                x={ax.tx}
                y={ax.ty + 13}
                textAnchor={ax.anchor}
                className="fill-[#6B7280] text-[10px] font-mono tabular-nums"
              >
                {ax.value}/100
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface CategoryBreakdownItem {
  category: string;
  total: number;
  completed: number;
  avg_mastery: number;
}

export const CategoryProgressBars: React.FC<{ items: CategoryBreakdownItem[] }> = ({ items }) => {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
        return (
          <div key={item.category} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#111317]">{item.category}</span>
              <span className="font-mono tabular-nums text-xs text-[#6B7280]">
                {item.completed}/{item.total} completed · {pct}%
              </span>
            </div>
            <div className="h-2 w-full bg-[#EFEFF1] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#C81E2B] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface BeltDistItem {
  name: string;
  color_hex: string;
  student_count: number;
}

export const BeltDistributionChart: React.FC<{ items: BeltDistItem[] }> = ({ items }) => {
  const max = Math.max(1, ...items.map((i) => i.student_count));
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const widthPct = Math.round((item.student_count / max) * 100);
        const isWhite = item.color_hex.toUpperCase() === '#E5E7EB';
        return (
          <div key={item.name} className="grid grid-cols-[100px_1fr_36px] items-center gap-3 text-sm">
            <span className="text-[#374151] font-medium truncate">{item.name}</span>
            <div className="h-2.5 bg-[#F3F4F6] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-300"
                style={{
                  width: `${Math.max(item.student_count > 0 ? 8 : 0, widthPct)}%`,
                  backgroundColor: isWhite ? '#9CA3AF' : item.color_hex,
                }}
              />
            </div>
            <span className="font-mono tabular-nums text-right text-xs text-[#4B5563]">{item.student_count}</span>
          </div>
        );
      })}
    </div>
  );
};
