const riskStyles = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  MODERATE: 'bg-amber-100 text-amber-800 border-amber-200',
  HIGH: 'bg-red-100 text-red-800 border-red-200',
};

const asList = value => Array.isArray(value) ? value : value ? [value] : [];

export default function DecisionBrief({ decision, title = 'AI decision brief' }) {
  if (!decision) return null;
  const result = decision.result || decision;
  const risk = String(result.risk || 'MODERATE').toUpperCase();
  const metrics = asList(result.metrics || result.successMetrics);
  const sections = asList(result.sections);
  const actions = asList(result.actions || result.shotList);
  const gaps = asList(result.evidenceGaps || result.complianceNotes);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">{title}</p>
            <h3 className="mt-2 text-2xl font-semibold">{result.headline || 'Evidence-led recommendation'}</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-200">{result.executiveSummary || result.angle || 'Review the structured findings and retain the final human decision.'}</p>
          </div>
          <div className="flex gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${riskStyles[risk] || riskStyles.MODERATE}`}>{risk} RISK</span>
            {result.confidence != null && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">{result.confidence}% confidence</span>}
            {result.stageDecision && <span className="rounded-full border border-indigo-300/30 bg-indigo-400/20 px-3 py-1 text-xs font-bold">{result.stageDecision}</span>}
          </div>
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <div key={`${metric.label || 'metric'}-${index}`} className="bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label || `Metric ${index + 1}`}</p>
              <div className="mt-1 text-xl font-bold text-slate-900"><HumanValue value={metric.value ?? metric} compact /></div>
              {metric.interpretation && <p className="mt-1 text-xs leading-5 text-slate-500">{metric.interpretation}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {result.hook && <BriefSection title="Opening hook" detail={result.hook} />}
          {result.script && <BriefSection title="Production script" detail={result.script} />}
          {result.avatarBrief && <BriefSection title="Creator direction" detail={result.avatarBrief} />}
          {result.productionPrompt && <BriefSection title="Production prompt" detail={result.productionPrompt} />}
          {sections.map((section, index) => <BriefSection key={`${section.title}-${index}`} title={section.title || `Finding ${index + 1}`} detail={section.detail || section} />)}
          {!result.hook && !result.script && sections.length === 0 && result.response && <BriefSection title="Analysis" detail={result.response} />}
        </div>
        <aside className="space-y-4">
          {actions.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <h4 className="font-semibold text-indigo-950">Recommended actions</h4>
              <ol className="mt-3 space-y-3">
                {actions.map((action, index) => <li key={index} className="flex gap-3 text-sm leading-5 text-indigo-950"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{index + 1}</span><HumanValue value={action} compact /></li>)}
              </ol>
            </div>
          )}
          {gaps.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="font-semibold text-amber-950">Evidence and compliance checks</h4>
              <ul className="mt-3 space-y-2 text-sm leading-5 text-amber-900">
                {gaps.map((gap, index) => <li key={index} className="flex gap-2"><span>•</span><HumanValue value={gap} compact /></li>)}
              </ul>
            </div>
          )}
          {decision.provider && <div className="rounded-xl border border-slate-200 p-4 text-xs text-slate-500"><p><strong className="text-slate-700">Provider:</strong> {decision.provider}</p><p className="mt-1 break-all"><strong className="text-slate-700">Model:</strong> {decision.model}</p></div>}
        </aside>
      </div>
    </section>
  );
}

function BriefSection({ title, detail }) {
  return <div className="rounded-xl border border-slate-200 p-4"><h4 className="font-semibold text-slate-900">{title}</h4><div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600"><HumanValue value={detail} /></div></div>;
}

function HumanValue({ value, compact = false }) {
  if (value == null || value === '') return <span className="text-slate-400">Not provided</span>;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    return <ul className={compact ? 'space-y-1' : 'space-y-2'}>{value.map((item, index) => <li key={index} className="flex gap-2"><span className="text-indigo-500">•</span><HumanValue value={item} compact /></li>)}</ul>;
  }
  if (typeof value === 'object') {
    const preferred = value.action || value.title || value.detail || value.note;
    const remainder = Object.entries(value).filter(([key]) => !['action', 'title', 'detail', 'note'].includes(key));
    return <div className={compact ? 'space-y-1' : 'space-y-2'}>{preferred && <p className="font-medium"><HumanValue value={preferred} compact /></p>}{remainder.map(([key, item]) => <div key={key} className={compact ? 'inline' : 'grid gap-1 sm:grid-cols-[140px_1fr]'}><span className="mr-1 font-semibold text-slate-700">{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').replace(/^./, char => char.toUpperCase())}{compact ? ':' : ''}</span><HumanValue value={item} compact /></div>)}</div>;
  }
  return <span>{String(value)}</span>;
}
