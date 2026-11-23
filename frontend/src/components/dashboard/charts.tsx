"use client";

import { useState } from "react";
import type { DashboardRun, HorizonResults } from "@/lib/dashboard";
import { strategyNames } from "@/lib/dashboard";
import { formatCurrency, formatFraction, formatNumber } from "@/lib/format";

const compact = (n: number) => formatCurrency(n, { compact: true });
const percent = (n: number, total: number) => formatFraction(n / total, 1);

export function LossDistribution({ data, thresholds }: { data: HorizonResults; thresholds: number[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? selected;
  const labels = [
    "$0",
    ...thresholds.map((end, i) => i === 0 ? `>$0 – <${compact(end)}` : `${compact(thresholds[i - 1])} – <${compact(end)}`),
    `${compact(thresholds[thresholds.length - 1])}+`,
  ];
  const maximum = Math.max(...data.loss_counts, 1);
  return (
    <figure className="dash-panel">
      <figcaption><p className="dash-kicker">Monte Carlo</p><h2>Total loss distribution</h2></figcaption>
      <div className="dash-bars">
        <div className="dash-axis" aria-hidden><span>0%</span><span>{percent(maximum, data.periods)}</span></div>
        {data.loss_counts.map((count, i) => (
          <button type="button" key={labels[i]} aria-pressed={selected === i}
            aria-label={`${labels[i]}, ${formatNumber(count)} periods, ${percent(count, data.periods)}`}
            onClick={() => setSelected(selected === i ? null : i)}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}
            className="dash-bar" data-active={active === i}>
            <span>{labels[i]}</span>
            <span className="dash-track" aria-hidden><i style={{ width: `${count / maximum * 100}%` }} /></span>
            <strong>{percent(count, data.periods)}</strong>
          </button>
        ))}
      </div>
      <div className="dash-chart-note" aria-live="polite">
        {active === null ? `${formatNumber(data.periods)} complete periods` :
          `${labels[active]} · ${formatNumber(data.loss_counts[active])} of ${formatNumber(data.periods)} periods`}
      </div>
    </figure>
  );
}

const fairMeasures = {
  expected_annual_loss_usd: "Expected annual loss",
  events_per_year: "Events per year",
  mean_loss_per_event_usd: "Mean loss per event",
};

export function FairExposure({ run, strategy, onSelect }: {
  run: DashboardRun; strategy: string; onSelect: (key: string) => void;
}) {
  const [metric, setMetric] = useState<keyof typeof fairMeasures>("expected_annual_loss_usd");
  const fmt = (v: number | null) => metric === "events_per_year" ? formatNumber(v, 3) : formatCurrency(v);
  const rows = Object.entries(run.strategies);
  const max = Math.max(0, ...rows.map(([, item]) => item[metric] ?? 0));
  return (
    <section className="dash-panel" aria-labelledby="fair-chart-title">
      <div className="dash-controls justify-between">
        <div><p className="dash-kicker">FAIR</p><h2 id="fair-chart-title">Annual exposure by portfolio</h2></div>
        <label>Measure<select value={metric} onChange={e => setMetric(e.target.value as keyof typeof fairMeasures)}>
          {Object.entries(fairMeasures).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select></label>
      </div>
      <div className="dash-fair-bars">
        {rows.map(([key, item]) => <button type="button" key={key} aria-pressed={strategy === key}
          onClick={() => onSelect(key)} className="dash-fair-bar">
          <span>{strategyNames[key]}</span>
          <span className="dash-track" aria-hidden><i style={{ width: `${max ? (item[metric] ?? 0) / max * 100 : 0}%` }} /></span>
          <strong>{fmt(item[metric])}</strong>
        </button>)}
      </div>
    </section>
  );
}

const incidentLabels = ["No incidents", "1 incident", "2 incidents", "3+ incidents"];
const incidentColors = ["#c7ddbe", "#569b84", "#126c61", "#254343"];

export function IncidentMix({ data }: { data: HorizonResults }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? selected;
  const shares = data.incident_counts.map(n => n / data.periods * 100);
  return (
    <figure className="dash-panel">
      <figcaption><p className="dash-kicker">Monte Carlo</p><h2>Disruptive incidents per period</h2></figcaption>
      <div className="dash-mix">
        <div className="dash-ring">
          <svg viewBox="0 0 120 120" aria-hidden>
            {shares.map((share, i) => share > 0 && (
              <circle key={i} cx="60" cy="60" r="48" fill="none" stroke={incidentColors[i]} strokeWidth="16"
                pathLength="100" strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-shares.slice(0, i).reduce((a, b) => a + b, 0)} transform="rotate(-90 60 60)"
                opacity={active === null || active === i ? 1 : 0.33} pointerEvents="visibleStroke"
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(selected === i ? null : i)} />
            ))}
          </svg>
          <div className="dash-ring-value" aria-live="polite">
            <strong>{active === null ? formatNumber(data.periods) : percent(data.incident_counts[active], data.periods)}</strong>
            <span>{active === null ? "Periods" : incidentLabels[active]}</span>
          </div>
        </div>
        <div className="dash-legend">
          {incidentLabels.map((label, i) => (
            <button key={label} type="button" aria-pressed={selected === i} data-active={active === i}
              onClick={() => setSelected(selected === i ? null : i)}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}>
              <i style={{ background: incidentColors[i] }} /><span>{label}</span><strong>{formatNumber(data.incident_counts[i])}</strong>
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function PortfolioTable({ run, horizon, strategy, onSelect }: {
  run: DashboardRun; horizon: number; strategy: string; onSelect: (key: string) => void;
}) {
  return (
    <section className="dash-panel">
      <p className="dash-kicker">FAIR &amp; Monte Carlo</p><h2>Portfolio comparison</h2>
      <div className="dash-table-scroll" tabIndex={0} role="region" aria-label="Portfolio comparison table">
        <table className="dash-table">
          <thead>
            <tr><th rowSpan={2} scope="col">Portfolio</th><th colSpan={3} scope="colgroup">FAIR annual exposure</th><th colSpan={2} scope="colgroup">Monte Carlo · {horizon}-year loss</th></tr>
            <tr>{["Events / year", "Loss / event", "Expected annual loss", "Mean", "95th percentile"].map(label => <th key={label} scope="col">{label}</th>)}</tr>
          </thead>
          <tbody>{Object.entries(run.strategies).map(([key, item]) => (
            <tr key={key} data-active={strategy === key}>
              <th scope="row"><button type="button" aria-pressed={key === strategy} onClick={() => onSelect(key)}>{strategyNames[key]}</button></th>
              <td>{formatNumber(item.events_per_year, 3)}</td>
              <td>{formatCurrency(item.mean_loss_per_event_usd)}</td>
              <td>{formatCurrency(item.expected_annual_loss_usd)}</td>
              <td>{formatCurrency(item.horizons[horizon].mean_loss_usd)}</td>
              <td>{formatCurrency(item.horizons[horizon].p95_loss_usd)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
