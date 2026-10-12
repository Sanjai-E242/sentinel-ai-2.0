import React, { useState } from 'react';
import { TrajectoryReplayItem, TrajectoryState, RiskForecast } from '@sentinel/shared';

interface RiskTrajectoryGraphProps {
  actions: TrajectoryReplayItem[];
  forecast?: RiskForecast;
  interventionWindow?: string;
  className?: string;
}

export const RiskTrajectoryGraph: React.FC<RiskTrajectoryGraphProps> = ({
  actions,
  forecast,
  interventionWindow,
  className = ''
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!actions || actions.length === 0) {
    return (
      <div className={`p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary ${className}`}>
        <p className="text-xs text-slate-400">No action history recorded for this session yet.</p>
      </div>
    );
  }

  // SVG coordinate dimensions
  const width = 760;
  const height = 270;
  const paddingLeft = 45;
  const paddingRight = 95;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Reserve 3 imaginary step slots on the right for forecast if forecast is present
  const totalSlots = forecast ? Math.max(actions.length + 3, 6) : Math.max(actions.length, 2);
  const stepWidth = chartWidth / (totalSlots - 1);

  const getX = (index: number) => {
    return paddingLeft + index * stepWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    return paddingTop + chartHeight - (clamped / 100) * chartHeight;
  };

  // Build points for risk line and deviation line
  const riskPoints = actions.map((a, i) => `${getX(i)},${getY(a.risk)}`).join(' ');
  const devPoints = actions.map((a, i) => `${getX(i)},${getY(a.trajectoryDeviation)}`).join(' ');

  // Area under risk curve
  const firstX = getX(0);
  const lastIndex = actions.length - 1;
  const lastX = getX(lastIndex);
  const bottomY = getY(0);
  const riskAreaPath = `M ${firstX},${bottomY} L ${actions.map((a, i) => `${getX(i)},${getY(a.risk)}`).join(' L ')} L ${lastX},${bottomY} Z`;

  // Build forecast points connecting from current position
  let forecastPoints = '';
  if (forecast && actions.length > 0) {
    const p0 = `${getX(lastIndex)},${getY(actions[lastIndex].risk)}`;
    const p1 = `${getX(lastIndex + 1)},${getY(forecast.nextActionRisk)}`;
    const p2 = `${getX(lastIndex + 2)},${getY(forecast.actionPlus2Risk)}`;
    const p3 = `${getX(lastIndex + 3)},${getY(forecast.actionPlus3Risk)}`;
    forecastPoints = `${p0} ${p1} ${p2} ${p3}`;
  }

  const getStateColor = (state: TrajectoryState) => {
    switch (state) {
      case 'NORMAL':
        return '#10b981'; // emerald
      case 'WATCH':
        return '#f59e0b'; // amber
      case 'DRIFTING':
        return '#f97316'; // orange
      case 'ESCALATING':
        return '#ef4444'; // rose
      case 'CRITICAL':
        return '#dc2626'; // dark red
      default:
        return '#64748b';
    }
  };

  const isOptimalNow = interventionWindow === 'OPTIMAL_WINDOW';

  return (
    <div className={`relative bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-tactile-subtle ${className}`}>
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold tracking-tight uppercase text-slate-400">
              Sequential Risk & Trajectory Timeline
            </h3>
            {isOptimalNow && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1">
                <span>★</span>
                <span>OPTIMAL INTERVENTION WINDOW</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
            Chronological behavioral drift across {actions.length} action{actions.length === 1 ? '' : 's'}
            {forecast ? ` • Forward trajectory horizon (+3 steps)` : ''}
          </p>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block" />
            <span>Cumulative Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-sky-400 inline-block" />
            <span>Trajectory Deviation</span>
          </div>
          {forecast && (
            <div className="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400">
              <span className="w-3 h-0.5 border-t border-dashed border-indigo-500 inline-block" />
              <span>Risk Forecast</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[550px] select-none"
        >
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Threshold Bands */}
          {/* 70 - 100: Escalating / Critical (Too Late Region) */}
          <rect
            x={paddingLeft}
            y={getY(100)}
            width={chartWidth}
            height={getY(70) - getY(100)}
            className="fill-rose-500/5 dark:fill-rose-500/10"
          />
          {/* 50 - 70: Drifting / Optimal Window Zone */}
          <rect
            x={paddingLeft}
            y={getY(70)}
            width={chartWidth}
            height={getY(50) - getY(70)}
            className="fill-amber-500/5 dark:fill-amber-500/10"
          />
          {/* 30 - 50: Watch */}
          <rect
            x={paddingLeft}
            y={getY(50)}
            width={chartWidth}
            height={getY(30) - getY(50)}
            className="fill-amber-500/5 dark:fill-amber-500/10"
          />
          {/* 0 - 30: Normal (Too Early Region) */}
          <rect
            x={paddingLeft}
            y={getY(30)}
            width={chartWidth}
            height={getY(0) - getY(30)}
            className="fill-emerald-500/5 dark:fill-emerald-500/5"
          />

          {/* Horizontal Grid lines */}
          {[0, 30, 50, 70, 100].map((val) => (
            <g key={val}>
              <line
                x1={paddingLeft}
                y1={getY(val)}
                x2={paddingLeft + chartWidth}
                y2={getY(val)}
                className="stroke-slate-200/80 dark:stroke-slate-800"
                strokeDasharray={val === 0 ? undefined : '3 3'}
                strokeWidth={val === 0 ? '1.5' : '1'}
              />
              <text
                x={paddingLeft - 8}
                y={getY(val) + 3.5}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-mono"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Intervention Threshold Marker Line (at Risk = 70) */}
          <line
            x1={paddingLeft}
            y1={getY(70)}
            x2={paddingLeft + chartWidth}
            y2={getY(70)}
            className="stroke-rose-400 dark:stroke-rose-500/80"
            strokeDasharray="6 3"
            strokeWidth="1.5"
          />
          <text
            x={paddingLeft + 6}
            y={getY(70) - 5}
            className="text-[9px] fill-rose-600 dark:fill-rose-400 font-mono font-bold tracking-wider"
          >
            INTERVENTION THRESHOLD (70)
          </text>

          {/* State Threshold Labels on right */}
          <text x={paddingLeft + chartWidth + 6} y={getY(15)} className="text-[9px] fill-emerald-600 dark:fill-emerald-400 font-semibold">
            NORMAL (TOO EARLY)
          </text>
          <text x={paddingLeft + chartWidth + 6} y={getY(40)} className="text-[9px] fill-amber-600 dark:fill-amber-400 font-semibold">
            WATCH
          </text>
          <text x={paddingLeft + chartWidth + 6} y={getY(60)} className="text-[9px] fill-orange-600 dark:fill-orange-400 font-semibold">
            DRIFT (OPTIMAL)
          </text>
          <text x={paddingLeft + chartWidth + 6} y={getY(85)} className="text-[9px] fill-rose-600 dark:fill-rose-400 font-semibold">
            CRIT (TOO LATE)
          </text>

          {/* Risk Gradient Area */}
          <path d={riskAreaPath} fill="url(#riskGradient)" />

          {/* Trajectory Deviation Line (dashed sky) */}
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 4"
            points={devPoints}
            className="opacity-80"
          />

          {/* Cumulative Risk Line (solid emerald) */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={riskPoints}
          />

          {/* Forward Forecast Line (dashed indigo) */}
          {forecastPoints && (
            <g>
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                points={forecastPoints}
              />
              {/* Forecast Step Nodes */}
              {[
                { idx: lastIndex + 1, risk: forecast!.nextActionRisk, label: '+1' },
                { idx: lastIndex + 2, risk: forecast!.actionPlus2Risk, label: '+2' },
                { idx: lastIndex + 3, risk: forecast!.actionPlus3Risk, label: '+3' }
              ].map((fStep) => {
                const fx = getX(fStep.idx);
                const fy = getY(fStep.risk);
                return (
                  <g key={fStep.label}>
                    <circle
                      cx={fx}
                      cy={fy}
                      r="4"
                      fill="#6366f1"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={fx}
                      y={fy - 8}
                      textAnchor="middle"
                      className="text-[9px] font-mono fill-indigo-600 dark:fill-indigo-400 font-bold"
                    >
                      {fStep.risk}
                    </text>
                    <text
                      x={fx}
                      y={height - 15}
                      textAnchor="middle"
                      className="text-[9px] font-mono fill-indigo-400"
                    >
                      {fStep.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Historical Data Points */}
          {actions.map((act, i) => {
            const cx = getX(i);
            const cy = getY(act.risk);
            const pointColor = getStateColor(act.state);
            const isHovered = hoveredIdx === i;
            const isLast = i === lastIndex;

            return (
              <g
                key={act.eventId || i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Outer halo on hover */}
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8"
                    fill={pointColor}
                    opacity="0.3"
                    className="animate-ping"
                  />
                )}

                {/* Optimal Intervention Point Callout on Last Action */}
                {isLast && isOptimalNow && (
                  <g>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="12"
                      fill="#f59e0b"
                      opacity="0.2"
                      className="animate-pulse"
                    />
                    <text
                      x={cx}
                      y={cy - 12}
                      textAnchor="middle"
                      className="text-[12px] fill-amber-500 font-bold"
                    >
                      ★
                    </text>
                  </g>
                )}

                {/* Main point */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? '6' : isLast ? '5.5' : '4.5'}
                  fill={pointColor}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all"
                />

                {/* X-axis action number label */}
                <text
                  x={cx}
                  y={height - 15}
                  textAnchor="middle"
                  className={`text-[10px] font-mono ${
                    isHovered || isLast
                      ? 'fill-slate-900 dark:fill-slate-100 font-bold'
                      : 'fill-slate-400'
                  }`}
                >
                  #{i + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIdx !== null && actions[hoveredIdx] && (
          <div
            className="absolute z-20 pointer-events-none p-3 bg-slate-900/95 dark:bg-slate-900/95 text-white rounded-xl shadow-tactile-prominent border border-slate-700/60 backdrop-blur-md text-xs space-y-1 min-w-[200px]"
            style={{
              left: `${Math.min(70, Math.max(8, (hoveredIdx / (actions.length - 1 || 1)) * 75))}%`,
              top: '15px'
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
              <span className="font-semibold text-emerald-400">
                Action #{hoveredIdx + 1} — {actions[hoveredIdx].action}
              </span>
              <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300">
                {actions[hoveredIdx].state}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 truncate">
              <strong>Resource:</strong> {actions[hoveredIdx].resource}
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span>Risk: <strong>{actions[hoveredIdx].risk}/100</strong></span>
              <span>Dev: <strong>{actions[hoveredIdx].trajectoryDeviation}/100</strong></span>
              <span className="text-emerald-300">[{actions[hoveredIdx].decision}]</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
