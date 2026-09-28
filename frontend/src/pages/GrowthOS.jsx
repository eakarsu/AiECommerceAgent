import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../services/api';
import DecisionBrief from '../components/DecisionBrief';
import ScenarioButtons, { clearNativeForm, fillNativeForm } from '../components/ScenarioButtons';

const sections = [
  { id: 'pipeline', label: 'Growth Pipeline', icon: '◈', description: 'Discovery through measured revenue' },
  { id: 'validation', label: 'Product Validation', icon: '✓', description: 'Demand evidence and winning score' },
  { id: 'suppliers', label: 'Supplier Economics', icon: '◇', description: 'Reliability, landed cost and Shopify' },
  { id: 'creative', label: 'Creative Studio', icon: '✦', description: 'Viral evidence and AI UGC production' },
  { id: 'testing', label: 'Test & Scale', icon: '↗', description: '30-day plan and paid stage gates' },
];

const stageOrder = ['discovery','validated','supplier_ready','creative_ready','organic_test','paid_test','scale'];
const stageLabel = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
const money = value => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const percent = value => `${Number(value || 0).toFixed(1)}%`;

const scenarios = {
  validated: { name: 'Compact Produce Saver', category: 'Kitchen', problemStatement: 'Fresh produce spoils before households can use it', targetAudience: 'Health-conscious households and meal preppers', sellingPrice: 34.99, unitCost: 9.2, shippingCost: 2.6, transactionFeeRate: .029, targetCpa: 10, evidenceViews: 890000, creatorCount: 7, purchaseIntentComments: 286, trendAgeDays: 21, evergreen: true, problemSolutionScore: 91, supplierScore: 92 },
  watchlist: { name: 'Portable Aroma Diffuser', category: 'Wellness', problemStatement: 'Travelers want a familiar calming environment away from home', targetAudience: 'Frequent travelers and wellness buyers', sellingPrice: 39.99, unitCost: 16.8, shippingCost: 4.9, transactionFeeRate: .029, targetCpa: 12, evidenceViews: 240000, creatorCount: 3, purchaseIntentComments: 52, trendAgeDays: 74, evergreen: true, problemSolutionScore: 76, supplierScore: 69 },
  reject: { name: 'Seasonal LED Mask', category: 'Costume', problemStatement: 'Party attendees want a novelty visual effect', targetAudience: 'Seasonal event shoppers', sellingPrice: 24.99, unitCost: 12.9, shippingCost: 4.5, transactionFeeRate: .029, targetCpa: 9, evidenceViews: 120000, creatorCount: 1, purchaseIntentComments: 11, trendAgeDays: 230, evergreen: false, problemSolutionScore: 48, supplierScore: 61 },
};

const initialForm = { ...scenarios.validated };
const emptyProductForm = Object.fromEntries(Object.keys(initialForm).map(key => [key, key === 'evergreen' ? false : '']));
const decisionScenarios = [
  {label:'Standard Review',tone:'standard',values:{analysisType:'full_validation',objective:'Decide whether this product has sufficient evidence and economics to advance one controlled stage.',riskTolerance:'balanced',decisionHorizon:'30 days',notes:'Prioritize verified demand, landed margin, supplier reliability and measurable stage-gate evidence.'}},
  {label:'Capital-at-Risk Review',tone:'risk',values:{analysisType:'downside_review',objective:'Protect acquisition capital by identifying the earliest measurable reason to hold or stop this product.',riskTolerance:'conservative',decisionHorizon:'14 days',notes:'Stress-test cost drift, creative saturation, delivery failure, refund exposure and break-even CPA.'}},
  {label:'Exception Review',tone:'exception',values:{analysisType:'exception_review',objective:'Resolve conflicting evidence before any new spend, supplier commitment or storefront expansion.',riskTolerance:'minimal',decisionHorizon:'7 days',notes:'Treat missing, stale or contradictory source evidence as an explicit decision blocker.'}},
];
const ugcScenarios = [
  {label:'Standard UGC',tone:'standard',values:{platform:'tiktok',angle:'Problem-to-solution product proof',audienceVoice:'Practical customer sharing an honest discovery',durationSeconds:22,callToAction:'Invite the viewer to review the product details',constraints:'No unsupported performance claims; show the product in use and retain source-evidence references.'}},
  {label:'Trust-Risk UGC',tone:'risk',values:{platform:'instagram',angle:'Objection handling with side-by-side proof',audienceVoice:'Skeptical buyer who verifies quality before recommending',durationSeconds:30,callToAction:'Ask viewers to confirm fit and specifications before ordering',constraints:'Disclose limitations, avoid urgency pressure, and do not imply medical, financial or guaranteed outcomes.'}},
  {label:'Evidence Exception',tone:'exception',values:{platform:'youtube',angle:'Evidence-gap review rather than promotional claim',audienceVoice:'Independent product reviewer documenting what is known and unknown',durationSeconds:45,callToAction:'Request missing evidence before purchase',constraints:'Do not invent demonstrations, testimonials, benchmarks, availability or delivery promises.'}},
];

export default function GrowthOS({ initialSection = 'pipeline' }) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [overview, setOverview] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [creatives, setCreatives] = useState([]);
  const [plans, setPlans] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [economics, setEconomics] = useState(null);
  const [decision, setDecision] = useState(null);
  const [ugcDecision, setUgcDecision] = useState(null);
  const [supplierDecision, setSupplierDecision] = useState(null);
  const [shopifyDecision, setShopifyDecision] = useState(null);
  const [decisionInputs,setDecisionInputs]=useState({...decisionScenarios[0].values});
  const [ugcInputs,setUgcInputs]=useState({...ugcScenarios[0].values});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const loadCore = async () => {
    const [overviewData, opportunityData, supplierData, creativeData, planData, experimentData] = await Promise.all([
      apiGet('/growth/overview'), apiGet('/growth/opportunities'), apiGet('/growth/suppliers'),
      apiGet('/growth/creatives'), apiGet('/growth/plans'), apiGet('/growth/experiments'),
    ]);
    setOverview(overviewData); setOpportunities(opportunityData); setSuppliers(supplierData);
    setCreatives(creativeData); setPlans(planData); setExperiments(experimentData);
    if (!selectedId && opportunityData.length) setSelectedId(opportunityData[0].id);
  };

  useEffect(() => { loadCore().catch(error => showNotice(error.message, 'error')); }, []);
  useEffect(() => { setActiveSection(initialSection); }, [initialSection]);
  useEffect(() => {
    if (!selectedId) return;
    apiGet(`/growth/opportunities/${selectedId}`).then(setSelected).catch(error => showNotice(error.message, 'error'));
  }, [selectedId]);

  const selectedSuppliers = useMemo(() => suppliers.filter(item => Number(item.opportunity_id) === Number(selectedId)), [suppliers, selectedId]);
  const selectedCreatives = useMemo(() => creatives.filter(item => Number(item.opportunity_id) === Number(selectedId)), [creatives, selectedId]);
  const selectedPlans = useMemo(() => plans.filter(item => Number(item.opportunity_id) === Number(selectedId)), [plans, selectedId]);
  const selectedExperiments = useMemo(() => experiments.filter(item => Number(item.opportunity_id) === Number(selectedId)), [experiments, selectedId]);

  function showNotice(message, type = 'success') {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 5000);
  }

  async function refreshSelected() {
    await loadCore();
    if (selectedId) setSelected(await apiGet(`/growth/opportunities/${selectedId}`));
  }

  async function calculateOnly() {
    setBusy('economics');
    try { setEconomics(await apiPost('/growth/economics/calculate', form)); }
    catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function createOpportunity(event) {
    event.preventDefault(); setBusy('create');
    try {
      const normalizedName = String(form.name || '').trim().toLowerCase();
      const existing = opportunities.find(item => String(item.name || '').trim().toLowerCase() === normalizedName);
      if (existing) {
        setSelectedId(existing.id);
        setSelected(await apiGet(`/growth/opportunities/${existing.id}`));
        showNotice(`${existing.name} already exists and is now selected. You can capture evidence for it below.`);
        window.setTimeout(() => document.getElementById('demand-evidence-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        return;
      }
      const result = await apiPost('/growth/opportunities', form);
      setEconomics(result.economics); setSelectedId(result.opportunity.id);
      showNotice(`${result.opportunity.name} scored ${result.opportunity.readiness_score}/100 and was saved.`);
      await loadCore();
      setSelected(await apiGet(`/growth/opportunities/${result.opportunity.id}`));
      window.setTimeout(() => document.getElementById('demand-evidence-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } catch (error) {
      if (error.status === 409 && error.data?.existingOpportunity?.id) {
        const existing = error.data.existingOpportunity;
        setSelectedId(existing.id);
        setSelected(await apiGet(`/growth/opportunities/${existing.id}`));
        showNotice(`${existing.name} already exists and is now selected. You can capture evidence for it below.`);
        window.setTimeout(() => document.getElementById('demand-evidence-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      } else {
        showNotice(error.message, 'error');
      }
    }
    finally { setBusy(''); }
  }

  async function addEvidence(event) {
    event.preventDefault();
    if (!selectedId) { showNotice('Save or select a product opportunity before capturing evidence.', 'error'); return; }
    const formElement = event.currentTarget;
    const values = Object.fromEntries(new FormData(formElement));
    setBusy('evidence');
    let evidenceSaved = false;
    try {
      await apiPost(`/growth/opportunities/${selectedId}/evidence`, values);
      evidenceSaved = true;
      formElement.reset();
      await refreshSelected();
      const reviewInput = {
        analysisType: decisionInputs.analysisType || 'full_validation',
        objective: String(decisionInputs.objective || '').trim().length >= 12
          ? decisionInputs.objective
          : 'Assess whether the newly captured demand evidence supports advancing this product.',
        riskTolerance: decisionInputs.riskTolerance || 'balanced',
        decisionHorizon: decisionInputs.decisionHorizon || '30 days',
        notes: decisionInputs.notes || 'Prioritize source recency, independent creator repetition, purchase intent, supplier readiness and contribution economics.',
      };
      const aiDecision = await apiPost(`/growth/opportunities/${selectedId}/ai-decision`, reviewInput);
      setDecision(aiDecision);
      showNotice('Evidence captured, score recalculated, and OpenRouter review completed.');
      window.setTimeout(() => document.getElementById('growth-ai-decision')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (error) {
      if (evidenceSaved) {
        showNotice(`Evidence was saved and scored, but OpenRouter analysis failed: ${error.message}`, 'error');
      } else {
        showNotice(error.message, 'error');
      }
    }
    finally { setBusy(''); }
  }

  async function selectSupplier(id) {
    setBusy(`supplier-${id}`);
    try { await apiPost(`/growth/suppliers/${id}/select`); showNotice('Primary supplier updated.'); await refreshSelected(); }
    catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function addSupplier(event) {
    event.preventDefault();
    if (!selectedId) { showNotice('Select a product opportunity before adding a supplier.', 'error'); return; }
    const formElement = event.currentTarget;
    const values = Object.fromEntries(new FormData(formElement));
    setBusy('add-supplier'); setSupplierDecision(null);
    try {
      const response = await apiPost('/growth/suppliers', { ...values, opportunityId: selectedId });
      const supplier = response.supplier;
      setSupplierDecision(response.aiReview);
      formElement.reset();
      await refreshSelected();
      showNotice(`${supplier.name} added with a ${supplier.reliability_score}/100 reliability score and an OpenRouter review.`);
      window.setTimeout(() => document.getElementById('supplier-ai-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
    catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function queueShopify() {
    setBusy('shopify'); setShopifyDecision(null);
    try {
      const result = await apiPost(`/growth/opportunities/${selectedId}/shopify-import`, {});
      setShopifyDecision(result.aiReview);
      showNotice(result.importRef ? `${result.message} Reference: ${result.importRef}` : result.message, result.success ? 'success' : 'error');
      await refreshSelected();
      window.setTimeout(() => document.getElementById('shopify-ai-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
    catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function runDecision(event) {
    event?.preventDefault();
    setBusy('decision'); setDecision(null);
    try { const result = await apiPost(`/growth/opportunities/${selectedId}/ai-decision`, decisionInputs); setDecision(result); showNotice('OpenRouter decision saved to the audit history.'); await refreshSelected(); }
    catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function createUgcBrief(event) {
    event?.preventDefault();
    setBusy('ugc'); setUgcDecision(null);
    try { const result = await apiPost(`/growth/opportunities/${selectedId}/ugc-brief`, ugcInputs); setUgcDecision(result); showNotice('UGC production brief created and saved.'); await refreshSelected(); }
    catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function advanceStage() {
    if (!selected || selected.stage === 'scale' || selected.stage === 'rejected') return;
    const next = stageOrder[stageOrder.indexOf(selected.stage) + 1];
    setBusy('stage');
    try {
      await apiPost(`/growth/opportunities/${selectedId}/stage`, { stage: next, reason: `Evidence and operating metrics reviewed before advancing to ${stageLabel(next)}`, nextAction: `Complete ${stageLabel(next)} success criteria` });
      showNotice(`Advanced to ${stageLabel(next)}.`); await refreshSelected();
    } catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function addExperiment(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const values = Object.fromEntries(new FormData(formElement));
    setBusy('experiment');
    try { await apiPost('/growth/experiments', { ...values, opportunityId: selectedId }); formElement.reset(); showNotice('Measured experiment added to the revenue pipeline.'); await refreshSelected(); }
    catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function completePlan(item) {
    setBusy(`plan-${item.id}`);
    try { await apiPost(`/growth/plans/${item.id}/result`, { actualValue: item.target_value, status: 'passed' }); showNotice(`Days ${item.day_start}–${item.day_end} marked passed with retained evidence.`); await refreshSelected(); }
    catch (error) { showNotice(error.message, 'error'); }
    finally { setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {notice && <div className={`fixed right-6 top-20 z-50 max-w-md rounded-xl border px-4 py-3 shadow-xl ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.message}</div>}

      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-7 text-white shadow-xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-200">AI Commerce · Revenue system</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Dropship Growth OS</h1><p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">Validate real demand, protect unit economics, produce evidence-led creative, and advance products only when measured outcomes pass the stage gate.</p></div>
          <span className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white">Evidence-grounded AI decisions</span>
        </div>
        {overview && <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><HeroMetric label="Opportunities" value={overview.summary.opportunities} /><HeroMetric label="Ready to advance" value={overview.summary.advance_count} /><HeroMetric label="Scaling" value={overview.summary.scaling_count} /><HeroMetric label="Measured revenue" value={money(overview.summary.measured_revenue)} /><HeroMetric label="Portfolio ROAS" value={`${(Number(overview.summary.measured_revenue || 0) / Math.max(Number(overview.summary.measured_spend || 0), 1)).toFixed(2)}x`} /></div>}
      </header>

      <nav className="grid gap-3 md:grid-cols-5">
        {sections.map(section => <button key={section.id} onClick={() => setActiveSection(section.id)} className={`rounded-2xl border p-4 text-left transition ${activeSection === section.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200'}`}><span className="text-xl text-indigo-600">{section.icon}</span><p className="mt-2 text-sm font-bold text-slate-900">{section.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p></button>)}
      </nav>

      <ProductSelector opportunities={opportunities} selectedId={selectedId} onSelect={setSelectedId} />
      <AIReviewPanel values={decisionInputs} setValues={setDecisionInputs} onSubmit={runDecision} busy={busy} disabled={!selectedId} />

      {activeSection === 'pipeline' && <PipelineSection opportunities={opportunities} selected={selected} experiments={selectedExperiments} onAdvance={advanceStage} busy={busy} onSection={setActiveSection} />}
      {activeSection === 'validation' && <ValidationSection form={form} setForm={setForm} onSubmit={createOpportunity} onCalculate={calculateOnly} economics={economics} busy={busy} selected={selected} onEvidence={addEvidence} />}
      {activeSection === 'suppliers' && <><SupplierSection selected={selected} suppliers={selectedSuppliers} onSelect={selectSupplier} onAdd={addSupplier} onShopify={queueShopify} busy={busy} />{supplierDecision && <div id="supplier-ai-review" className="scroll-mt-24"><DecisionBrief decision={supplierDecision} title="OpenRouter supplier risk review" /></div>}{shopifyDecision && <div id="shopify-ai-review" className="scroll-mt-24"><DecisionBrief decision={shopifyDecision} title="OpenRouter Shopify merchandising review" /></div>}</>}
      {activeSection === 'creative' && <CreativeSection selected={selected} creatives={selectedCreatives} onGenerate={createUgcBrief} busy={busy} ugcDecision={ugcDecision} values={ugcInputs} setValues={setUgcInputs} />}
      {activeSection === 'testing' && <TestingSection selected={selected} plans={selectedPlans} experiments={selectedExperiments} onAdvance={advanceStage} onExperiment={addExperiment} onCompletePlan={completePlan} busy={busy} />}
      {decision && <div id="growth-ai-decision" className="scroll-mt-24"><DecisionBrief decision={decision} title="OpenRouter product investment review" /></div>}
    </div>
  );
}

function ProductSelector({ opportunities, selectedId, onSelect }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active product case</p><p className="text-sm text-slate-600">Every workflow below uses the same evidence-backed record.</p></div><select className="input max-w-xl" value={selectedId || ''} onChange={event => onSelect(event.target.value)}>{opportunities.map(item => <option key={item.id} value={item.id}>{item.name} · {item.readiness_score}/100 · {stageLabel(item.stage)}</option>)}</select></div></div>;
}

function AIReviewPanel({values,setValues,onSubmit,busy,disabled}){
  const field=(name,value)=>setValues(current=>({...current,[name]:value}));
  return <form onSubmit={onSubmit} className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">OpenRouter decision operation</p><h2 className="mt-1 text-xl font-bold text-slate-900">AI product investment review</h2><p className="mt-1 text-sm text-slate-600">Every requested and optional review field is visible, editable and retained with the decision.</p></div><ScenarioButtons scenarios={decisionScenarios} onApply={next=>setValues({...next})} onClear={()=>setValues({analysisType:'',objective:'',riskTolerance:'',decisionHorizon:'',notes:''})}/></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><SelectValue label="Analysis type" value={values.analysisType} onChange={v=>field('analysisType',v)} options={['full_validation','downside_review','exception_review']}/><Input label="Decision objective" value={values.objective} onChange={v=>field('objective',v)}/><SelectValue label="Risk tolerance" value={values.riskTolerance} onChange={v=>field('riskTolerance',v)} options={['balanced','conservative','minimal']}/><Input label="Decision horizon" value={values.decisionHorizon} onChange={v=>field('decisionHorizon',v)}/><Input label="Review notes (optional)" value={values.notes} onChange={v=>field('notes',v)}/></div><button disabled={disabled||busy==='decision'||!values.analysisType||!values.objective} className="btn btn-ai mt-5">{busy==='decision'?'OpenRouter is analyzing…':'Run AI Investment Review'}</button></form>;
}

function PipelineSection({ opportunities, selected, experiments, onAdvance, busy, onSection }) {
  const stages = stageOrder.map(stage => ({ stage, items: opportunities.filter(item => item.stage === stage) }));
  const revenue = experiments.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const spend = experiments.reduce((sum, item) => sum + Number(item.spend || 0), 0);
  return <div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Unified product pipeline</h2><p className="mt-1 text-sm text-slate-500">One accountable record from discovery evidence through revenue measurement.</p></div>{selected && selected.stage !== 'scale' && selected.stage !== 'rejected' && <button onClick={onAdvance} disabled={busy === 'stage'} className="btn btn-primary">{busy === 'stage' ? 'Validating gate…' : `Advance to ${stageLabel(stageOrder[stageOrder.indexOf(selected.stage) + 1])}`}</button>}</div><div className="mt-6 grid gap-3 xl:grid-cols-7">{stages.map((column, index) => <div key={column.stage} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">{stageLabel(column.stage)}</span><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">{column.items.length}</span></div><div className="mt-3 space-y-2">{column.items.slice(0,4).map(item => <div key={item.id} className={`rounded-lg border bg-white p-2 text-xs ${Number(selected?.id) === Number(item.id) ? 'border-indigo-400' : 'border-slate-200'}`}><p className="font-semibold text-slate-800">{item.name}</p><p className="mt-1 text-slate-500">Score {item.readiness_score}</p></div>)}</div>{index < stages.length - 1 && <div className="mt-3 text-center text-indigo-400">→</div>}</div>)}</div></section>{selected && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="Winning-product score" value={`${selected.readiness_score}/100`} detail={selected.recommendation} /><MetricCard label="Measured revenue" value={money(revenue)} detail={`${money(spend)} measured spend`} /><MetricCard label="Current stage" value={stageLabel(selected.stage)} detail={selected.next_action} /><MetricCard label="Shopify workflow" value={stageLabel(selected.shopify_status)} detail={selected.shopify_product_ref || 'No import reference yet'} /></div>}<div className="grid gap-4 md:grid-cols-4"><WorkflowLink title="Validate demand" text="Capture TikTok and Instagram evidence." onClick={() => onSection('validation')} /><WorkflowLink title="Protect margin" text="Compare delivery and supplier reliability." onClick={() => onSection('suppliers')} /><WorkflowLink title="Produce creative" text="Turn viral evidence into governed UGC briefs." onClick={() => onSection('creative')} /><WorkflowLink title="Test then scale" text="Use organic and paid success gates." onClick={() => onSection('testing')} /></div></div>;
}

function ValidationSection({ form, setForm, onSubmit, onCalculate, economics, busy, selected, onEvidence }) {
  const field = (name, value) => setForm(current => ({ ...current, [name]: value }));
  const evidenceRef=useRef(null);
  const evidenceScenarios=[
    {label:'Strong Demand',tone:'standard',values:{platform:'tiktok',sourceUrl:'https://www.tiktok.com/@homeproof/video/7400000000001',creatorHandle:'@homeproof',publishedAt:'2026-07-24',views:685000,likes:48200,comments:1380,purchaseIntentComments:312,evidenceExcerpt:'Where can I order this, and does it ship to the US?'}},
    {label:'Demand Risk',tone:'risk',values:{platform:'instagram',sourceUrl:'https://www.instagram.com/reel/demand-risk-2026',creatorHandle:'@practicalbuyer',publishedAt:'2026-05-12',views:84000,likes:2100,comments:188,purchaseIntentComments:19,evidenceExcerpt:'Looks useful, but several comments question durability and delivery time.'}},
    {label:'Stale Exception',tone:'exception',values:{platform:'youtube',sourceUrl:'https://www.youtube.com/watch?v=stale-product-evidence',creatorHandle:'@archivefinds',publishedAt:'2024-11-08',views:1200000,likes:31800,comments:920,purchaseIntentComments:4,evidenceExcerpt:'The original seller link no longer works and availability is unknown.'}},
  ];
  return <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Winning-product validator</h2><p className="mt-1 text-sm text-slate-500">Validate a specific problem, current demand, creator repetition, purchase intent, evergreen fit and economics.</p></div><ScenarioButtons scenarios={[{label:'Validated Product',tone:'standard',values:scenarios.validated},{label:'Watchlist Product',tone:'risk',values:scenarios.watchlist},{label:'Rejected Product',tone:'exception',values:scenarios.reject}]} onApply={value=>setForm({...value})} onClear={()=>{setForm({...emptyProductForm});}} /></div><div className="mt-6 grid gap-4 md:grid-cols-2"><Input label="Product name" value={form.name} onChange={v => field('name',v)} required /><Input label="Category" value={form.category} onChange={v => field('category',v)} required /><TextArea label="Problem solved" value={form.problemStatement} onChange={v => field('problemStatement',v)} required /><TextArea label="Target customer" value={form.targetAudience} onChange={v => field('targetAudience',v)} required /><Input label="Recent evidence views" type="number" value={form.evidenceViews} onChange={v => field('evidenceViews',v)} /><Input label="Independent creators" type="number" value={form.creatorCount} onChange={v => field('creatorCount',v)} /><Input label="Purchase-intent comments" type="number" value={form.purchaseIntentComments} onChange={v => field('purchaseIntentComments',v)} /><Input label="Newest evidence age (days)" type="number" value={form.trendAgeDays} onChange={v => field('trendAgeDays',v)} /><Input label="Problem-solution score" type="number" value={form.problemSolutionScore} onChange={v => field('problemSolutionScore',v)} /><Input label="Supplier confidence score" type="number" value={form.supplierScore} onChange={v => field('supplierScore',v)} /><Input label="Selling price" type="number" step="0.01" value={form.sellingPrice} onChange={v => field('sellingPrice',v)} /><Input label="Supplier unit cost" type="number" step="0.01" value={form.unitCost} onChange={v => field('unitCost',v)} /><Input label="Shipping cost" type="number" step="0.01" value={form.shippingCost} onChange={v => field('shippingCost',v)} /><Input label="Transaction fee rate" type="number" step="0.001" value={form.transactionFeeRate} onChange={v => field('transactionFeeRate',v)} /><Input label="Target CPA" type="number" step="0.01" value={form.targetCpa} onChange={v => field('targetCpa',v)} /><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(form.evergreen)} onChange={e => field('evergreen',e.target.checked)} className="h-4 w-4" /> Evergreen demand</label></div><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={onCalculate} className="btn btn-secondary">Calculate unit economics</button><button type="submit" disabled={busy === 'create'} className="btn btn-primary">{busy === 'create' ? 'Scoring…' : 'Score & Save Opportunity'}</button></div></form><div className="space-y-6">{economics ? <Economics economics={economics} /> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Calculate economics to reveal landed cost, break-even CPA and profit per order.</div>}{selected ? <form id="demand-evidence-form" ref={evidenceRef} onSubmit={onEvidence} className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">Evidence-grounded OpenRouter operation</p><h3 className="mt-1 font-bold text-slate-900">Ingest and analyze demand evidence for {selected.name}</h3><p className="mt-1 text-sm text-slate-500">Save source-level proof, recalculate the portfolio score, and generate a professional AI investment review.</p></div><span className="badge badge-info">AI review included</span></div><ScenarioButtons className="mt-4" scenarios={evidenceScenarios} onApply={values=>fillNativeForm(evidenceRef.current,values)} onClear={()=>clearNativeForm(evidenceRef.current)} /><div className="mt-4 grid gap-3 sm:grid-cols-2"><SelectInput name="platform" label="Platform" options={['tiktok','instagram','youtube','facebook','other']} /><NamedInput name="sourceUrl" label="Source URL" placeholder="https://…" required /><NamedInput name="creatorHandle" label="Creator handle" placeholder="@creator" required /><NamedInput name="publishedAt" label="Published date" type="date" required /><NamedInput name="views" label="Views" type="number" /><NamedInput name="likes" label="Likes" type="number" /><NamedInput name="comments" label="Comments" type="number" /><NamedInput name="purchaseIntentComments" label="Purchase-intent comments" type="number" /><div className="sm:col-span-2"><NamedInput name="evidenceExcerpt" label="Evidence excerpt" placeholder="Representative purchase-intent comment" /></div></div><button type="submit" disabled={busy === 'evidence'} className="btn btn-ai mt-4">{busy === 'evidence' ? 'Capturing evidence and running OpenRouter…' : 'Capture Evidence & Run AI Review'}</button></form>:<div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 p-6"><h3 className="font-bold text-indigo-950">Save or select a product first</h3><p className="mt-2 text-sm leading-6 text-indigo-800">Demand evidence must be linked to a saved product opportunity. Score and save the product, or select an existing case above, to unlock evidence capture.</p><button type="button" disabled className="btn btn-primary mt-4 opacity-50">Capture Evidence</button></div>}</div></div>;
}

function SupplierSection({ selected, suppliers, onSelect, onAdd, onShopify, busy }) {
  const supplierRef=useRef(null);
  const supplierScenarios=[
    {label:'Reliable Supplier',tone:'standard',values:{name:'Domestic Fulfillment Partner',marketplace:'AutoDS',productUrl:'https://supplier.example/domestic-verified',unitCost:11.4,shippingCost:2.2,deliveryDays:5,rating:4.9,orderCount:18400,onTimeRate:98.2,disputeRate:0.6}},
    {label:'Margin Risk',tone:'risk',values:{name:'Low-Cost Overseas Candidate',marketplace:'CJdropshipping',productUrl:'https://supplier.example/overseas-review',unitCost:8.7,shippingCost:5.9,deliveryDays:14,rating:4.2,orderCount:3800,onTimeRate:84.5,disputeRate:4.8}},
    {label:'Supplier Exception',tone:'exception',values:{name:'Unverified Marketplace Seller',marketplace:'AliExpress',productUrl:'https://supplier.example/unverified-exception',unitCost:6.1,shippingCost:9.5,deliveryDays:28,rating:3.1,orderCount:74,onTimeRate:61.0,disputeRate:12.5}},
  ];
  return <div className="space-y-6"><section id="supplier-comparison" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Supplier discovery and comparison</h2><p className="mt-1 text-sm text-slate-500">Compare delivered cost, lead time, service history and failure risk—not unit price alone.</p></div><button onClick={onShopify} disabled={!selected || busy === 'shopify'} className="btn btn-primary">{busy === 'shopify' ? 'Running OpenRouter…' : 'Generate AI Shopify Draft'}</button></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-3">Supplier</th><th className="p-3">Source</th><th className="p-3">Delivered cost</th><th className="p-3">Break-even CPA</th><th className="p-3">Delivery</th><th className="p-3">On-time</th><th className="p-3">Disputes</th><th className="p-3">Reliability</th><th className="p-3">Decision</th></tr></thead><tbody>{suppliers.map(item => <tr key={item.id} className={`border-b border-slate-100 ${item.selected ? 'bg-emerald-50' : ''}`}><td className="p-3"><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.order_count} source orders · {item.rating}/5</p></td><td className="p-3">{item.marketplace}</td><td className="p-3 font-semibold">{money(item.landed_cost)}</td><td className="p-3 font-semibold text-indigo-700">{money(item.break_even_cpa)}</td><td className="p-3">{item.delivery_days} days</td><td className="p-3">{percent(item.on_time_rate)}</td><td className="p-3">{percent(item.dispute_rate)}</td><td className="p-3"><Score value={item.reliability_score} /></td><td className="p-3"><button onClick={() => onSelect(item.id)} disabled={item.selected || busy === `supplier-${item.id}`} className={`rounded-lg px-3 py-2 text-xs font-bold ${item.selected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-900 text-white'}`}>{item.selected ? 'Primary' : 'Select'}</button></td></tr>)}</tbody></table>{!suppliers.length && <p className="p-8 text-center text-sm text-slate-500">No supplier candidates have been captured for this product.</p>}</div></section><form ref={supplierRef} onSubmit={onAdd} className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="font-bold text-slate-900">Add supplier candidate</h3><p className="mt-1 text-sm text-slate-500">Reliability is calculated from rating, on-time history, disputes and delivery speed. OpenRouter then reviews the candidate against the product economics and retained evidence.</p><ScenarioButtons className="mt-4" scenarios={supplierScenarios} onApply={values=>fillNativeForm(supplierRef.current,values)} onClear={()=>clearNativeForm(supplierRef.current)} /><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><NamedInput name="name" label="Supplier name" required /><NamedInput name="marketplace" label="Source marketplace" placeholder="AutoDS, Spocket…" required /><NamedInput name="productUrl" label="Product URL" placeholder="https://…" /><NamedInput name="unitCost" label="Unit cost" type="number" required /><NamedInput name="shippingCost" label="Shipping cost" type="number" /><NamedInput name="deliveryDays" label="Delivery days" type="number" required /><NamedInput name="rating" label="Rating (0–5)" type="number" required /><NamedInput name="orderCount" label="Source orders" type="number" /><NamedInput name="onTimeRate" label="On-time rate %" type="number" required /><NamedInput name="disputeRate" label="Dispute rate %" type="number" /></div><button disabled={busy === 'add-supplier'} className="btn btn-ai mt-4">{busy === 'add-supplier' ? 'Running OpenRouter…' : 'Score, Add & Run AI Review'}</button></form>{selected && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Supplier readiness" value={`${selected.supplier_score}/100`} detail="Reliability-weighted" /><MetricCard label="Selling price" value={money(selected.selling_price)} detail="Current validated offer" /><MetricCard label="Shopify status" value={stageLabel(selected.shopify_status)} detail={selected.shopify_product_ref || 'Awaiting stage gate'} /><MetricCard label="Selected supplier" value={suppliers.find(item => item.selected)?.name || 'Not selected'} detail="Primary fulfillment source" /></div>}</div>;
}

function CreativeSection({ selected, creatives, onGenerate, busy, ugcDecision, values, setValues }) {
  const evidence = selected?.evidence || [];
  const field=(name,value)=>setValues(current=>({...current,[name]:value}));
  return <div className="space-y-6"><div className="grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Viral-video evidence library</h2><p className="mt-1 text-sm text-slate-500">Source evidence remains linked to the product decision and creative brief.</p></div><span className="badge badge-info">{evidence.length} sources</span></div><div className="mt-5 space-y-3">{evidence.map(item => <a key={item.id} href={item.source_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{item.creator_handle}</p><span className="badge badge-gray">{item.platform}</span></div><p className="mt-2 text-sm italic text-slate-600">“{item.evidence_excerpt || 'No excerpt captured'}”</p><div className="mt-3 flex gap-4 text-xs text-slate-500"><span>{Number(item.views).toLocaleString()} views</span><span>{item.purchase_intent_comments} purchase-intent comments</span><span>{new Date(item.published_at).toLocaleDateString()}</span></div></a>)}{!evidence.length && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Capture demand evidence before producing creative.</p>}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-6"><div><h2 className="text-xl font-bold text-slate-900">AI UGC production workflow</h2><p className="mt-1 text-sm text-slate-500">OpenRouter converts verified evidence and all creative inputs into a production-ready brief.</p></div><ScenarioButtons className="mt-4" scenarios={ugcScenarios} onApply={next=>setValues({...next})} onClear={()=>setValues({platform:'',angle:'',audienceVoice:'',durationSeconds:'',callToAction:'',constraints:''})}/><form onSubmit={onGenerate} className="mt-4 grid gap-3 sm:grid-cols-2"><SelectValue label="Platform" value={values.platform} onChange={v=>field('platform',v)} options={['tiktok','instagram','facebook','youtube']}/><Input label="Creative angle" value={values.angle} onChange={v=>field('angle',v)}/><Input label="Audience voice (optional)" value={values.audienceVoice} onChange={v=>field('audienceVoice',v)}/><Input label="Duration seconds" type="number" value={values.durationSeconds} onChange={v=>field('durationSeconds',v)}/><Input label="Call to action (optional)" value={values.callToAction} onChange={v=>field('callToAction',v)}/><Input label="Constraints (optional)" value={values.constraints} onChange={v=>field('constraints',v)}/><button disabled={!selected||busy==='ugc'||!values.platform||!values.angle} className="btn btn-ai sm:col-span-2">{busy==='ugc'?'Directing creative…':'Generate UGC Brief'}</button></form><div className="mt-5 grid gap-3">{creatives.map(item => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{item.platform} · {stageLabel(item.asset_type)}</p><p className="mt-1 font-semibold text-slate-900">{item.hook}</p></div><span className="badge badge-success h-fit">{item.status}</span></div><p className="mt-2 text-sm text-slate-600">{item.angle}</p>{item.predicted_ctr && <p className="mt-3 text-xs font-semibold text-slate-500">Predicted CTR {item.predicted_ctr}%</p>}</div>)}</div></section></div>{ugcDecision && <DecisionBrief decision={ugcDecision} title="AI UGC production brief" />}</div>;
}

function TestingSection({ selected, plans, experiments, onAdvance, onExperiment, onCompletePlan, busy }) {
  const experimentRef=useRef(null);
  const experimentScenarios=[
    {label:'Winning Test',tone:'standard',values:{channel:'meta_ads',experimentName:'Validated three-angle paid test',dailyBudget:75,spend:315,impressions:43800,clicks:1620,sessions:1280,addToCarts:126,purchases:34,revenue:1019.66,status:'passed'}},
    {label:'CPA Risk',tone:'risk',values:{channel:'tiktok_ads',experimentName:'High CPA creative review',dailyBudget:90,spend:540,impressions:71200,clicks:1840,sessions:1210,addToCarts:73,purchases:12,revenue:359.88,status:'active'}},
    {label:'Failed Exception',tone:'exception',values:{channel:'organic_instagram',experimentName:'Low-intent exception cohort',dailyBudget:0,spend:0,impressions:96000,clicks:780,sessions:310,addToCarts:4,purchases:0,revenue:0,status:'failed'}},
  ];
  return <div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Organic 30-day validation plan</h2><p className="mt-1 text-sm text-slate-500">Structured weekly proof before significant paid acquisition risk.</p></div>{selected && selected.stage !== 'scale' && selected.stage !== 'rejected' && <button onClick={onAdvance} disabled={busy === 'stage'} className="btn btn-primary">Review & Advance Stage</button>}</div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.filter(item => item.plan_type === 'organic_30_day').map(item => <PlanCard key={item.id} item={item} onComplete={() => onCompletePlan(item)} busy={busy === `plan-${item.id}`} />)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold text-slate-900">Paid product-testing stage gates</h2><p className="mt-1 text-sm text-slate-500">Controlled budgets, explicit CPA and ROAS thresholds, and measured revenue outcomes.</p><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-3">Experiment</th><th className="p-3">Channel</th><th className="p-3">Spend</th><th className="p-3">Purchases</th><th className="p-3">CPA</th><th className="p-3">Revenue</th><th className="p-3">ROAS</th><th className="p-3">Conversion</th><th className="p-3">Status</th></tr></thead><tbody>{experiments.map(item => <tr key={item.id} className="border-b border-slate-100"><td className="p-3 font-semibold text-slate-900">{item.experiment_name}</td><td className="p-3">{stageLabel(item.channel)}</td><td className="p-3">{money(item.spend)}</td><td className="p-3">{item.purchases}</td><td className="p-3">{money(item.cpa)}</td><td className="p-3 font-semibold">{money(item.revenue)}</td><td className="p-3 font-semibold text-indigo-700">{Number(item.roas).toFixed(2)}x</td><td className="p-3">{percent(item.conversion_rate)}</td><td className="p-3"><span className={`badge ${item.status === 'passed' ? 'badge-success' : item.status === 'failed' ? 'badge-danger' : 'badge-info'}`}>{item.status}</span></td></tr>)}</tbody></table>{!experiments.length && <p className="p-8 text-center text-sm text-slate-500">No measured experiment exists for this product yet.</p>}</div><div className="mt-6 grid gap-4 md:grid-cols-2">{plans.filter(item => item.plan_type === 'paid_test').map(item => <PlanCard key={item.id} item={item} onComplete={() => onCompletePlan(item)} busy={busy === `plan-${item.id}`} />)}</div></section><form ref={experimentRef} onSubmit={onExperiment} className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="font-bold text-slate-900">Record measured test</h3><p className="mt-1 text-sm text-slate-500">Persist channel inputs and revenue outcomes; CPA, ROAS and conversion are calculated by the API.</p><ScenarioButtons className="mt-4" scenarios={experimentScenarios} onApply={values=>fillNativeForm(experimentRef.current,values)} onClear={()=>clearNativeForm(experimentRef.current)} /><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SelectInput name="channel" label="Channel" options={['organic_tiktok','organic_instagram','meta_ads','tiktok_ads']} /><NamedInput name="experimentName" label="Experiment name" required /><NamedInput name="dailyBudget" label="Daily budget" type="number" /><NamedInput name="spend" label="Spend" type="number" /><NamedInput name="impressions" label="Impressions" type="number" /><NamedInput name="clicks" label="Clicks" type="number" /><NamedInput name="sessions" label="Sessions" type="number" /><NamedInput name="addToCarts" label="Add to carts" type="number" /><NamedInput name="purchases" label="Purchases" type="number" /><NamedInput name="revenue" label="Revenue" type="number" /><SelectInput name="status" label="Status" options={['planned','active','passed','failed','paused']} /></div><button disabled={busy === 'experiment'} className="btn btn-primary mt-4">{busy === 'experiment' ? 'Recording…' : 'Record Experiment'}</button></form></div>;
}

function Economics({ economics }) { return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><h3 className="font-bold text-emerald-950">Unit economics decision</h3><div className="mt-4 grid grid-cols-2 gap-3"><SmallMetric label="Landed cost" value={money(economics.landedCost)} /><SmallMetric label="Break-even CPA" value={money(economics.breakEvenCpa)} /><SmallMetric label="Net profit / order" value={money(economics.netProfitPerOrder)} /><SmallMetric label="Net margin" value={percent(economics.netMarginRate)} /><SmallMetric label="Price multiple" value={`${economics.priceMultiple}x`} /><SmallMetric label="Margin score" value={`${economics.marginScore}/100`} /></div><p className="mt-4 text-xs leading-5 text-emerald-800">Landed cost includes unit cost, shipping and transaction fees. Break-even CPA is the maximum acquisition cost before contribution profit reaches zero.</p></section>; }
function PlanCard({ item, onComplete, busy }) { const complete = item.actual_value != null; return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Days {item.day_start}–{item.day_end}</p><span className={`badge ${item.status === 'passed' ? 'badge-success' : item.status === 'failed' ? 'badge-danger' : 'badge-info'}`}>{item.status}</span></div><p className="mt-2 font-semibold text-slate-900">{item.objective}</p><p className="mt-2 text-xs text-slate-500">{stageLabel(item.success_metric)} · target {item.target_value}{complete ? ` · actual ${item.actual_value}` : ''}</p>{item.status !== 'passed' && <button onClick={onComplete} disabled={busy} className="mt-3 text-xs font-bold text-indigo-700 hover:text-indigo-900">{busy ? 'Saving…' : 'Record target achieved →'}</button>}</div>; }
function Score({ value }) { const score = Number(value || 0); return <div className="w-28"><div className="flex justify-between text-xs"><span>{score}/100</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} /></div></div>; }
function HeroMetric({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><p className="text-xs uppercase tracking-wide text-indigo-200">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
function MetricCard({ label, value, detail }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></div>; }
function SmallMetric({ label, value }) { return <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value}</p></div>; }
function WorkflowLink({ title, text, onClick }) { return <button onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"><p className="font-bold text-slate-900">{title} <span className="text-indigo-600">→</span></p><p className="mt-2 text-sm leading-5 text-slate-500">{text}</p></button>; }
function Input({ label, value, onChange, type = 'text', step, required }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input className="input" type={type} step={step} value={value} required={required} onChange={event => onChange(type === 'number' ? event.target.value : event.target.value)} /></label>; }
function TextArea({ label, value, onChange, required }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><textarea className="input min-h-24" value={value} required={required} onChange={event => onChange(event.target.value)} /></label>; }
function SelectValue({ label, value, onChange, options }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><select className="input" value={value} onChange={event=>onChange(event.target.value)}><option value="">Select…</option>{options.map(option=><option key={option} value={option}>{stageLabel(option)}</option>)}</select></label>; }
function NamedInput({ name, label, type = 'text', placeholder, required, step }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input className="input" name={name} type={type} step={type === 'number' ? (step || 'any') : undefined} placeholder={placeholder} required={required} /></label>; }
function SelectInput({ name, label, options }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><select className="input" name={name}>{options.map(option => <option key={option}>{option}</option>)}</select></label>; }
