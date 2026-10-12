import React, { useCallback, useEffect, useState } from 'react';
import NativeAIControls from './NativeAIControls';
import NativeAIReport, { reportText, reportValue } from './NativeAIReport';
import useNativeAIRequest from './useNativeAIRequest';
import { apiGet } from '../services/api';
import './NativeRuntimeAI.css';

const presetNames = ['Quick brief', 'Team planning', 'Detailed review'];

export default function NativeRuntimeAI({ config, request }) {
  const [fields, setFields] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [selectedSaved, setSelectedSaved] = useState(null);
  const native = useNativeAIRequest();

  const loadHistory = useCallback(async () => {
    try {
      const response = await apiGet(config.historyEndpoint || config.endpoint, { limit: 20 });
      setHistory(Array.isArray(response?.results) ? response.results : []);
      setHistoryError('');
    } catch (failure) {
      setHistoryError(failure.message || 'Saved results are unavailable.');
    }
  }, [config.endpoint, config.historyEndpoint]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const presets = presetNames.map((name, index) => ({
    name,
    fill: () => {
      setFields(Object.fromEntries(config.fields.map((field) => [field.key, field.examples[index]])));
      return { filled: config.fields.length, manual: [] };
    },
  }));

  async function generate(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    try {
      const body = Object.fromEntries(config.fields.map((field) => [field.key, fields[field.key] || '']));
      const response = await native.run((signal) => request(config.endpoint, body, { signal }));
      setResult(response);
      await loadHistory();
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'Request canceled.' : failure.response?.data?.error || failure.message);
    }
  }

  const savedSummary = (entry) => {
    const value = reportValue(entry.result);
    const text = reportText(value).replace(/\s+/g, ' ').trim();
    return text.length > 150 ? `${text.slice(0, 147)}…` : text;
  };

  return (
    <section className="native-runtime-ai" id="ai-readiness">
      <header>
        <p className="ai-eyebrow">Native AI workspace</p>
        <h1>{config.title}</h1>
        <p>{config.description}</p>
      </header>

      <NativeAIControls busy={native.busy} onCancel={native.cancel} presets={presets} context={config.title}>
        <form onSubmit={generate}>
          <div className="native-runtime-fields">
            {config.fields.map((field) => (
              <label key={field.key} htmlFor={`native-runtime-${field.key}`}>
                {field.label}{field.required ? ' *' : ' (optional)'}
                <textarea
                  id={`native-runtime-${field.key}`}
                  data-ai-field={field.key}
                  rows={5}
                  required={field.required}
                  maxLength={field.maxLength || 4000}
                  value={fields[field.key] || ''}
                  onChange={(event) => setFields({ ...fields, [field.key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <button type="submit" className="native-runtime-generate" disabled={native.busy}>
            {native.busy ? 'Generating…' : 'Generate with OpenRouter'}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      </NativeAIControls>

      {result && <NativeAIReport response={result} title={config.title} />}

      <section className="native-runtime-history" aria-labelledby="saved-ai-results-title">
        <div className="native-runtime-history-heading">
          <div>
            <p className="ai-eyebrow">Retained for this account</p>
            <h2 id="saved-ai-results-title">Saved AI results</h2>
          </div>
          <button type="button" onClick={loadHistory}>Refresh</button>
        </div>
        {historyError && <p className="native-runtime-history-error" role="alert">{historyError}</p>}
        {!historyError && history.length === 0 && <p className="native-runtime-empty">No saved reports yet.</p>}
        <div className="native-runtime-history-list">
          {history.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setSelectedSaved(entry)}>
              <span>
                <strong>Commerce advice #{entry.id}</strong>
                <small>{new Date(entry.created_at).toLocaleString()} · {entry.model}</small>
              </span>
              <span>{savedSummary(entry)}</span>
            </button>
          ))}
        </div>
      </section>

      {selectedSaved && (
        <div className="native-runtime-saved-overlay" role="dialog" aria-modal="true" aria-labelledby="saved-ai-result-title">
          <div className="native-runtime-saved-dialog">
            <header>
              <div>
                <p className="ai-eyebrow">Saved AI result</p>
                <h2 id="saved-ai-result-title">Commerce advice #{selectedSaved.id}</h2>
              </div>
              <button type="button" onClick={() => setSelectedSaved(null)}>Close</button>
            </header>
            <NativeAIReport
              response={selectedSaved.result}
              title="Saved commerce advice"
              model={selectedSaved.model}
            />
          </div>
        </div>
      )}
    </section>
  );
}
