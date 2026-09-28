const styles = {
  standard: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  risk: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
  exception: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
  clear: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
};

export default function ScenarioButtons({ scenarios, onApply, onClear, disabled = false, className = '' }) {
  return <div className={`flex flex-wrap gap-2 ${className}`}>
    {scenarios.map(scenario => <button key={scenario.label} type="button" disabled={disabled} onClick={() => onApply(scenario.values)} className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[scenario.tone || 'standard']}`}>Fill {scenario.label}</button>)}
    <button type="button" disabled={disabled} onClick={onClear} className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles.clear}`}>Clear All Fields</button>
  </div>;
}

export function fillNativeForm(form, values) {
  if (!form) return;
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value == null ? '' : String(value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export function clearNativeForm(form) {
  if (!form) return;
  for (const field of Array.from(form.elements)) {
    if (!field.name) continue;
    if (field.type === 'checkbox' || field.type === 'radio') field.checked = false;
    else if (!['button','submit'].includes(field.type)) field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
