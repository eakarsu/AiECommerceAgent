import fs from 'node:fs';
import assert from 'node:assert/strict';

const checks = {
  'src/pages/GrowthOS.jsx': [
    'decisionScenarios','ugcScenarios','ScenarioButtons','analysisType','objective','riskTolerance','decisionHorizon','notes',
    'platform','angle','audienceVoice','durationSeconds','callToAction','constraints','transactionFeeRate',
    'sourceUrl','creatorHandle','publishedAt','purchaseIntentComments','evidenceExcerpt','productUrl','shippingCost','orderCount','disputeRate',
    'dailyBudget','impressions','clicks','sessions','addToCarts','purchases','revenue',
  ],
  'src/pages/VisualSearch.jsx': ['ScenarioButtons','imageDescription','imageUrl','topK'],
  'src/pages/PhotoCritique.jsx': ['ScenarioButtons','productId','imageUrl'],
  'src/pages/InventoryReorder.jsx': ['ScenarioButtons','productId','leadTime'],
  'src/pages/PriceElasticity.jsx': ['ScenarioButtons','productId'],
  'src/pages/Concierge.jsx': ['ScenarioButtons','draft'],
  'src/pages/Batch03Features.jsx': ['sampleRequests','Clear All Fields','input'],
};

for (const [file,tokens] of Object.entries(checks)) {
  const source=fs.readFileSync(file,'utf8');
  for(const token of tokens)assert.ok(source.includes(token),`${file} is missing scenario coverage for ${token}`);
  const scenarioCount=(source.match(/label['"]?:|"label":/g)||[]).length;
  assert.ok(scenarioCount>=3,`${file} must expose at least three fill scenarios`);
  assert.ok(source.includes('Clear All Fields')||source.includes('onClear='),`${file} must expose a clear action`);
}

const growthSource=fs.readFileSync('src/pages/GrowthOS.jsx','utf8');
assert.ok(
  growthSource.includes("step={type === 'number' ? (step || 'any') : undefined}"),
  'Growth OS scenario forms must accept decimal supplier, economics, and performance values',
);

console.log(`Verified complete scenario controls across ${Object.keys(checks).length} explicit-input AI workflow pages.`);
