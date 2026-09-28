import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import governanceRouter from '../governance/router.js';
import governanceRuntime from '../governance/runtime.js';
import providerGateModule from '../governance/providerGate.js';
import authRouter from './routes/authGoverned.js';
import runtimeAiRouter from './routes/runtimeAi.js';
import growthOsRouter from './routes/growthOs.js';
import legacyCommerceRouter from './routes/index.js';
import growthConnectorsRouter from './routes/growthConnectors.js';
import dropshipOperationsRouter from './routes/dropshipOperations.js';
import customViewsRouter from './routes/customViews.js';
import aiExtraRouter from './routes/aiExtra.js';
import aiPass5Router from './routes/aiPass5.js';
import websocketService from './services/websocket.js';

dotenv.config({path:'../.env'});
governanceRuntime.validateRuntime();

const app=express();
const port=Number(process.env.BACKEND_PORT||3001);
const origins=String(process.env.CORS_ORIGINS||'http://localhost:5173').split(',').map(value=>value.trim()).filter(Boolean);
const frontendPort=String(process.env.FRONTEND_PORT||'');

function isPrivateDevelopmentOrigin(origin){
  if(process.env.NODE_ENV==='production'||!origin)return false;
  try{
    const parsed=new URL(origin);
    if(!['http:','https:'].includes(parsed.protocol))return false;
    if(frontendPort&&parsed.port!==frontendPort)return false;
    const host=parsed.hostname;
    if(host==='localhost'||host==='127.0.0.1'||host==='::1')return true;
    if(/^10\./.test(host)||/^192\.168\./.test(host))return true;
    const private172=host.match(/^172\.(\d+)\./);
    return Boolean(private172&&Number(private172[1])>=16&&Number(private172[1])<=31);
  }catch{
    return false;
  }
}

function allowCorsOrigin(origin,callback){
  if(!origin||origins.includes(origin)||isPrivateDevelopmentOrigin(origin))return callback(null,true);
  return callback(new Error('Origin not allowed by CORS'));
}

app.disable('x-powered-by');
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next();});
app.use(cors({origin:allowCorsOrigin,credentials:true}));
app.use(express.json({limit:'1mb'}));
app.use('/api/auth',authRouter);
app.use('/api/runtime-ai',runtimeAiRouter);
app.use('/api/growth',growthOsRouter);
app.use('/api/growth/connectors',growthConnectorsRouter);
app.use('/api/dropship-ops',dropshipOperationsRouter);
app.use('/api',customViewsRouter);
app.use(providerGateModule.createProviderGate(['/api/ai','/api/gap','/api/batch','/api/payment','/api/stripe','/api/recommendations']));
app.use('/api',aiExtraRouter);
app.use('/api',aiPass5Router);
app.get('/api/health',(_req,res)=>res.json({status:'ok',workflow:'reconciled_ecommerce_fulfillment',timestamp:new Date().toISOString()}));
app.use('/api/governance',governanceRouter);
app.use('/api',legacyCommerceRouter);
app.use((_req,res)=>res.status(404).json({error:'ROUTE_NOT_SUPPORTED'}));
app.use((error,_req,res,_next)=>{
  console.error('Request failed:',error.message);
  if(error.message==='Origin not allowed by CORS')return res.status(403).json({error:'ORIGIN_NOT_ALLOWED'});
  return res.status(500).json({error:'INTERNAL_SERVER_ERROR'});
});
const server=createServer(app);
websocketService.initialize(server);
server.listen(port,()=>console.log(`Governed ECommerce API listening on ${port}`));

export default app;
