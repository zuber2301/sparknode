import React, { useState, useEffect, useRef } from 'react';
import { 
  Rocket, LayoutGrid, History, Settings, Database, Server, Activity, 
  Shield, Terminal, Play, RotateCcw, Workflow, Globe, MoreVertical,
  CheckCircle2, Search, Plus, ArrowUpRight, Box, Cpu, Unplug,
  FlaskConical, ClipboardCheck, ShieldCheck, ChevronRight, 
  ExternalLink, Layers, RefreshCw as LucideRefreshCw, X, Cpu as CpuIcon
} from 'lucide-react';

const API_BASE = 'http://localhost:8090/api';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
      active 
        ? 'bg-indigo-600 text-white shadow-md' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon size={20} className={active ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'} />
    <span className="font-medium text-sm sm:text-base leading-tight">{label}</span>
    {active && <div className="ml-auto w-2 h-2 rounded-full bg-white shadow-sm" />}
  </button>
);

const ConfigModal = ({ provider, onClose, onConfirm }) => {
  const [formData, setFormData] = useState({
    subscription_id: '',
    client_id: '',
    client_secret: '',
    tenant_id: '',
    region: provider === 'aws' ? 'us-east-1' : provider === 'azure' ? 'eastus' : 'us-central1',
    instance_type: provider === 'aws' ? 't3.medium' : provider === 'azure' ? 'Standard_B2s' : 'e2-medium'
  });

  const fields = {
    aws: ['access_key', 'secret_key', 'region'],
    azure: ['subscription_id', 'client_id', 'client_secret', 'tenant_id'],
    gcp: ['project_id', 'region', 'zone']
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Provision Foundation</h3>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{provider} Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {fields[provider].map(field => (
            <div key={field}>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{field.replace('_', ' ')}</label>
              <input 
                type="text" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder={`Enter ${field}...`}
                value={formData[field] || ''}
                onChange={e => setFormData({...formData, [field]: e.target.value})}
              />
            </div>
          ))}
          
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Node Class</label>
            <div className="grid grid-cols-2 gap-3">
               <button className="p-3 border-2 border-indigo-600 bg-indigo-50 rounded-xl text-left">
                  <p className="font-bold text-indigo-900 text-sm">Burstable</p>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase">{formData.instance_type}</p>
               </button>
               <button className="p-3 border-2 border-slate-100 bg-white rounded-xl text-left opacity-50 grayscale">
                  <p className="font-bold text-slate-900 text-sm">Production</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Optimized</p>
               </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
          <button 
            onClick={() => onConfirm(formData)}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            Deploy Foundation
          </button>
        </div>
      </div>
    </div>
  );
};

const EnvCard = ({ id, name, icon: Icon, color, status, version, region, onDeploy, onRollback, deploying, host }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 group">
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div className={`w-14 h-14 ${color} bg-opacity-10 rounded-xl flex items-center justify-center`}>
          <Icon size={28} className={color.replace('bg-', 'text-')} />
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 ${
          status === 'Healthy' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          <div className={`w-2 h-2 rounded-full ${status === 'Healthy' ? 'bg-green-600' : 'bg-yellow-600'}`} />
          {status}
        </div>
      </div>
      
      <h4 className="text-xl font-bold text-slate-900 mb-1">{name}</h4>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 font-medium">
        <span>{region}</span>
        <span className="text-slate-300">•</span>
        <span className="font-mono text-xs">{host}</span>
      </div>
    </div>

    <div className="px-6 py-5 bg-slate-50 border-y border-slate-100 space-y-3">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-slate-600">Foundation Stack</span>
        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[10px]">TRAEFIK + DOCKER</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-slate-600">App Version</span>
        <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">{version}</span>
      </div>
    </div>

    <div className="p-6 flex flex-col gap-3">
      <button 
        onClick={onDeploy}
        disabled={deploying}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${color} text-white rounded-xl font-bold text-sm shadow-md hover:opacity-95 transition-all disabled:opacity-50`}
      >
        {deploying ? <LucideRefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
        {deploying ? 'Deploying...' : 'Provision & Deploy'}
      </button>
      
      <div className="flex gap-2">
        <button 
          onClick={onRollback}
          disabled={deploying}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 disabled:opacity-50 transition-all font-mono"
        >
          <RotateCcw size={14} /> ROLLBACK
        </button>
      </div>
    </div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('environments');
  const [logs, setLogs] = useState([]);
  const [activeDeployment, setActiveDeployment] = useState(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [deployingEnvs, setDeployingEnvs] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [configModal, setConfigModal] = useState(null);
  const logEndRef = useRef(null);
  const socketRef = useRef(null);

  const deploymentSteps = [
    { id: 'foundation', label: 'TF Foundation', icon: Database },
    { id: 'vm', label: 'Provision VM', icon: CpuIcon },
    { id: 'networking', label: 'Gateway/Traefik', icon: Globe },
    { id: 'pull', label: 'Image Pull', icon: Box },
    { id: 'deploy', label: 'Container UP', icon: Rocket },
    { id: 'health', label: 'Stack Health', icon: Activity }
  ];

  const environments = [
    { id: 'dev', name: 'AWS Cloud', icon: FlaskConical, color: 'bg-indigo-600', status: 'Healthy', version: 'v2.2.0', region: 'US-East-1', host: 'ec2-54-sparknode.io', provider: 'aws' },
    { id: 'qa', name: 'Azure Cloud', icon: ClipboardCheck, color: 'bg-indigo-400', status: 'Healthy', version: 'v2.1.1', region: 'East-US', host: 'spark-vm.azure.com', provider: 'azure' },
    { id: 'prod', name: 'GCP Cloud', icon: ShieldCheck, color: 'bg-slate-900', status: 'Healthy', version: 'v2.1.0', region: 'US-Central1', host: 'spark-lb.google.com', provider: 'gcp' }
  ];

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const connectToLogs = (deploymentId) => {
    if (socketRef.current) socketRef.current.close();
    setLogs([]);
    setActiveDeployment(deploymentId);

    const wsUrl = `ws://${window.location.hostname === 'localhost' ? 'localhost:8090' : window.location.host}/ws/deployments/${deploymentId}/logs`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => setIsWebSocketConnected(true);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.log) {
        setLogs(prev => [...prev, { 
          time: new Date().toLocaleTimeString(), 
          msg: data.log, 
          type: data.log.includes('ERROR') || data.log.includes('FAIL') ? 'error' : 
                data.log.includes('WARN') ? 'warn' : 'info'
        }]);
        
        if (data.log.includes('Terraform') || data.log.includes('Initializing')) setCurrentStep(0);
        if (data.log.includes('VM') || data.log.includes('IP:')) setCurrentStep(1);
        if (data.log.includes('Traefik') || data.log.includes('Nginx')) setCurrentStep(2);
        if (data.log.includes('Pulling')) setCurrentStep(3);
        if (data.log.includes('UP') || data.log.includes('Starting')) setCurrentStep(4);
        if (data.log.includes('SUCCESS') || data.log.includes('Healthy')) setCurrentStep(5);

        if (data.log.includes('SUCCESS') || data.log.includes('Deployment complete')) {
           setDeployingEnvs({});
        }
      }
    };
    socket.onclose = () => setIsWebSocketConnected(false);
  };

  const executeDeployment = async (env, config = {}) => {
    setDeployingEnvs({ [env.id]: true });
    setCurrentStep(0);
    setConfigModal(null);
    try {
      const resp = await fetch(`${API_BASE}/deployments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env_id: env.id, 
          release_tag: 'latest', 
          host: env.host, 
          provider: env.provider,
          config: config // Pass TF vars
        })
      });
      const data = await resp.json();
      connectToLogs(data.deployment_id);
    } catch (err) {
      console.error(err);
      setDeployingEnvs({});
    }
  };

  const triggerRollback = async (env) => {
    setDeployingEnvs({ [env.id]: true });
    setCurrentStep(0);
    try {
      const resp = await fetch(`${API_BASE}/rollback/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env_id: env.id, provider: env.provider
        })
      });
      const data = await resp.json();
      connectToLogs(data.deployment_id);
    } catch (err) {
      console.error(err);
      setDeployingEnvs({});
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden text-slate-800">
      {configModal && (
        <ConfigModal 
          provider={configModal.provider} 
          onClose={() => setConfigModal(null)} 
          onConfirm={(config) => executeDeployment(configModal, config)}
        />
      )}
      
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 p-6">
        <div className="flex items-center gap-4 mb-10 px-2 text-slate-900">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Rocket className="text-white" size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SparkNode</h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Control Plane</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-4">Core</p>
          <SidebarItem icon={LayoutGrid} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Server} label="Cloud Hub" active={activeTab === 'environments'} onClick={() => setActiveTab('environments')} />
          <SidebarItem icon={History} label="Audit Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <SidebarItem icon={Database} label="Infrastructure" active={activeTab === 'db'} onClick={() => setActiveTab('db')} />
        </nav>

        <div className="mt-auto p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
             <div className={`w-2.5 h-2.5 rounded-full ${isWebSocketConnected ? 'bg-green-600 animate-pulse' : 'bg-slate-400'}`} />
             <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">API Sync OK</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 flex items-center justify-between px-8 py-5">
           <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">
            <span>Orchestrator</span>
            <ChevronRight size={18} className="text-slate-300" />
            <span className="text-slate-900">Multi-Cloud Manager</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base">SA</div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          <div className="mb-12">
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Self-Hosted PaaS</h2>
            <p className="text-slate-600 text-lg leading-relaxed max-w-3xl">
              Two-step automation: <span className="text-indigo-600 font-bold">Foundation</span> (VM + Traefik) and 
              <span className="text-indigo-600 font-bold px-1.5">App Pipeline</span> (Docker Containers).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {environments.map((env) => (
              <EnvCard 
                key={env.id}
                {...env}
                deploying={deployingEnvs[env.id]}
                onDeploy={() => setConfigModal(env)}
                onRollback={() => triggerRollback(env)}
              />
            ))}
          </div>

          <div className="mt-12">
            {!activeDeployment ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm flex flex-col items-center justify-center text-center opacity-60">
                <Terminal size={48} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">System Ready</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-2 font-medium">
                  Select a provider to input Terraform variables and initiate the deployment sequence.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm scale-in-center">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                    <Activity size={18} className="text-indigo-600" /> 2-Step Workflow Tracing
                  </h3>
                  
                  <div className="flex justify-between relative px-2 mb-4">
                    <div className="absolute top-6 left-0 w-full h-1 bg-slate-100 z-0 rounded-full" />
                    <div className="absolute top-6 left-0 h-1 bg-indigo-600 transition-all duration-700 z-0 rounded-full" style={{ width: `${(currentStep / (deploymentSteps.length - 1)) * 100}%` }} />
                    
                    {deploymentSteps.map((step, idx) => (
                      <div key={step.id} className="flex flex-col items-center gap-3 relative z-10 w-24">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                          idx < currentStep ? 'bg-green-600 text-white' : 
                          idx === currentStep ? 'bg-indigo-600 text-white scale-110 shadow-lg' : 
                          'bg-white text-slate-300 border border-slate-200'
                        }`}>
                          {idx < currentStep ? <CheckCircle2 size={24} /> : <step.icon size={22} />}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider text-center ${idx === currentStep ? 'text-indigo-700' : 'text-slate-400'}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 bg-slate-900 rounded-2xl p-8 text-white flex flex-col min-h-[500px] shadow-xl border border-slate-800 relative overflow-hidden group/terminal">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800 relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 text-indigo-400">
                        <Terminal size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight">Active Execution Log</h3>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
                          <span className="opacity-70">Provider: {activeDeployment.split('-')[1]}</span>
                          <span className="text-slate-600">|</span>
                          <span className="animate-pulse">Streaming Physical Output</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="font-mono text-[14px] leading-relaxed space-y-2 flex-1 overflow-y-auto pr-4 scrollbar">
                    {logs.map((log, i) => (
                      <div key={i} className={`flex gap-4 p-1.5 rounded-lg border-l-4 transition-colors ${
                        log.type === 'error' ? 'bg-red-500/10 border-red-600 text-red-200' : 
                        log.type === 'warn' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-100' : 
                        'border-transparent text-slate-300 hover:bg-white/5'
                      }`}>
                        <span className="text-slate-500 tabular-nums font-medium opacity-50">[{log.time}]</span>
                        <span className="break-all whitespace-pre-wrap">{log.msg}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
