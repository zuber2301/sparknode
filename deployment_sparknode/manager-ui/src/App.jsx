import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  Terminal, 
  History, 
  Settings, 
  AlertTriangle, 
  Play, 
  RotateCcw, 
  Workflow, 
  Box, 
  Network
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const OperationalDashboard = () => {
  const [activeTab, setActiveTab] = useState('environments');
  const [deploying, setDeploying] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState(0);

  const envs = [
    { id: 'prod', status: 'Healthy', version: 'v1.4.2', region: 'ap-south-1', uptime: '21d', lastDeploy: '2h ago' },
    { id: 'staging', status: 'Healthy', version: 'v1.4.3-rc1', region: 'us-east-1', uptime: '4d', lastDeploy: '12h ago' },
    { id: 'dev', status: 'Healthy', version: 'v1.5.0-feat-logs', region: 'us-east-1', uptime: '1h', lastDeploy: '15m ago' }
  ];

  const deploySteps = [
    { id: 'infra', label: 'Provision Infrastructure', status: 'complete' },
    { id: 'pull', label: 'Pull Images (v1.4.4)', status: 'in-progress' },
    { id: 'migrate', label: 'Database Migrations', status: 'pending' },
    { id: 'restart', label: 'Service Restart', status: 'pending' },
    { id: 'verify', label: 'Health Validation', status: 'pending' }
  ];

  const DeploymentTimeline = () => (
    <div className="space-y-4 p-6 bg-slate-900 rounded-xl text-white font-mono text-sm border border-slate-700 shadow-2xl">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Workflow className="text-sparknode-blue" size={20} />
          <span className="font-bold">Active Rollout: Production (v1.4.4)</span>
        </div>
        <span className="text-xs bg-sparknode-blue/20 text-sparknode-blue px-2 py-1 rounded">IMAGE_PULLING</span>
      </div>
      
      {deploySteps.map((step, idx) => (
        <div key={idx} className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${
            step.status === 'complete' ? 'bg-sparknode-green shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
            step.status === 'in-progress' ? 'bg-sparknode-blue animate-pulse' : 'bg-slate-700'
          }`} />
          <span className={step.status === 'pending' ? 'text-slate-500' : 'text-slate-200'}>{step.label}</span>
          {step.status === 'complete' && <span className="text-[10px] text-sparknode-green uppercase ml-auto">DONE</span>}
        </div>
      ))}

      <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-blue-300 h-32 overflow-y-auto scrollbar-hide">
        [14:32:01] INFO: Initializing deployment engine...<br/>
        [14:32:05] INFO: Terraform plan matched local state. No drift detected.<br/>
        [14:32:10] INFO: Executing remote pull signal to [sparknode-prod-01]...<br/>
        [14:32:15] WARN: Layer [c2aed9] already exists in cache, skipping...<br/>
        <span className="animate-pulse">[14:32:21] INFO: Pulling layer [f8219x] (42.1MB / 102.5MB)...</span>
      </div>
    </div>
  );

  const EnvironmentCard = ({ env }) => (
    <div className="card hover:border-sparknode-purple/40 transition-all cursor-pointer group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-800 uppercase">{env.id}</h3>
          <p className="text-xs font-medium text-slate-500">{env.region}</p>
        </div>
        <div className="badge-success flex items-center gap-1.5 ring-4 ring-green-50">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {env.status}
        </div>
      </div>
      
      <div className="space-y-1.5 my-6">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Version</span>
          <span className="font-bold text-slate-700">{env.version}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Last Deploy</span>
          <span className="font-semibold text-slate-600">{env.lastDeploy}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-50">
        <button 
          onClick={() => setDeploying(true)}
          className="flex items-center justify-center gap-2 py-2 px-3 bg-sparknode-purple text-white rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-sparknode-purple/20"
        >
          <Play size={14} /> DEPLOY
        </button>
        <button className="flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm">
          <RotateCcw size={14} /> ROLLBACK
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 font-inter">
      <div className="max-w-7xl mx-auto flex gap-8">
        <div className="w-64 space-y-2 shrink-0 hidden lg:block">
           <div className="flex items-center gap-3 mb-10 px-4">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white shadow-lg">
               <Box size={22} />
             </div>
             <span className="font-black text-xl tracking-tight uppercase">Control Plane</span>
           </div>
           
           {[
             { id: 'environments', icon: Network, label: 'Environments' },
             { id: 'deployments', icon: Workflow, label: 'Deployments' },
             { id: 'releases', icon: History, label: 'Releases' },
             { id: 'infra', icon: Box, label: 'Infrastructure' },
             { id: 'settings', icon: Settings, label: 'Manager Settings' }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                 activeTab === tab.id ? 'bg-sparknode-purple text-white shadow-lg shadow-sparknode-purple/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
               }`}
             >
               <tab.icon size={18} /> {tab.label}
             </button>
           ))}
        </div>

        <div className="flex-1">
          <header className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">SparkNode Infrastructure</h1>
              <p className="text-slate-500 font-medium text-sm">Real-time Control Plane and Managed Orchestration</p>
            </div>
            
            <div className="flex gap-4">
               <div className="flex flex-col items-end">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Heartbeat</span>
                 <span className="text-sm font-bold text-sparknode-green flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-sparknode-green shadow-[0_0_8px_rgba(16,185,129,1)]" />
                   OPERATIONAL
                 </span>
               </div>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Active Environments</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {envs.map(env => <EnvironmentCard key={env.id} env={env} />)}
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Deployment Stream</h2>
              <AnimatePresence mode="wait">
                {deploying ? (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <DeploymentTimeline />
                    <button 
                      onClick={() => setDeploying(false)}
                      className="mt-4 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest flex items-center gap-1 mx-auto"
                    >
                      <RotateCcw size={12} /> Hide active stream
                    </button>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card !bg-slate-50 border-dashed border-2 border-slate-200 flex flex-col items-center justify-center h-80 text-center p-12">
                     <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-4">
                       <Workflow size={32} />
                     </div>
                     <h3 className="font-bold text-slate-500">Idle Engine</h3>
                     <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">Select an environment to broadcast a new release or system reconcile.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationalDashboard;
