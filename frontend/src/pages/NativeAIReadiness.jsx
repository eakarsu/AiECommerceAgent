import React from 'react';
import NativeRuntimeAI from '../components/NativeRuntimeAI';
import {apiPost} from '../services/api';
const request=(endpoint,body,options)=>apiPost(endpoint,body,options);
const config={
  "title": "Commerce operations advice",
  "description": "Native OpenRouter merchandising and fulfillment guidance. Review recommendations in the existing growth and commerce workflows before executing operational changes.",
  "endpoint": "/runtime-ai/commerce-advice",
  "fields": [
    {
      "key": "merchandising_context",
      "label": "Merchandising context",
      "required": true,
      "examples": [
        "Illustrative commerce merchandising brief: review current source information, identify missing evidence, and recommend three practical next steps for an authorized reviewer. Explain assumptions. This example authorizes no external action.",
        "Illustrative commerce merchandising team planning brief: compare feasible options, explain dependencies, assign suggested responsibilities and timing, and list evidence needed before any operational change. Use a concise professional table and action list.",
        "Illustrative commerce merchandising detailed review: summarize the supplied facts, separate uncertainties, compare alternatives and tradeoffs, and propose measurable next steps. Do not invent source records or claim that integrations, approvals or external actions occurred."
      ]
    },
    {
      "key": "goals",
      "label": "Goals",
      "required": false,
      "examples": [
        "Prioritize conversion improvements and explain missing measurements.",
        "Plan a team review with owners, timing and success measures.",
        "Compare options, evidence quality, risks and measurable next steps."
      ]
    },
    {
      "key": "fulfillment_constraints",
      "label": "Fulfillment constraints",
      "required": false,
      "examples": [
        "Illustrative constraints: limited staff time and a small test budget; no verified supplier commitments.",
        "Illustrative constraints: balance service quality, review capacity and budget; verify delivery assumptions.",
        "Illustrative constraints: require approved source data and human review before changing price, inventory, supplier or shipping decisions."
      ]
    }
  ]
};
export default function NativeAIReadiness(){return <NativeRuntimeAI config={config} request={request}/>;}
