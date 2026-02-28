import React, { useState, useEffect, useRef } from 'react';
import { 
  Rocket, LayoutGrid, History, Settings, Database, Server, Activity, 
  Shield, Terminal, Play, RotateCcw, Workflow, Globe, MoreVertical,
  CheckCircle2, Search, Plus, ArrowUpRight, Box, Cpu, Unplug,
  FlaskConical, ClipboardCheck, ShieldCheck, ChevronRight, 
  ExternalLink, Layers, RefreshCw as LucideRefreshCw
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

const EnvCard = ({ id, name, icon: Icon, color, status, version, region, onDeploy, deploying, host }) => (
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
        <span className="font-mono">{host}</span>
      </div>
    </div>

    <div className="px-6 py-5 bg-slate-50 border-y border-slate-100 space-y-3">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-slate-600">App Version</span>
        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{version}</span>
      </div>
      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
      </div>
    </div>

    <div className="p-6">
      <button 
        onClick={onDeploy}
        disabled={deploying}
        className={`w-full flex items-center justify-center gap-3 ${color} text-white py-3 rounded-lg font-semibold text-base shadow-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all`}>
        {deploying ? (
          <LucideRefreshCw className="animate-spin" size={20} />
        ) : (
          <Rocket size={20} />
        )}
        {deploying ? 'Deploying...' : `Deploy to ${name}`}
      </button>
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
  const logEndRef = useRef(null);
  const socketRef = useRef(null);

  const deploymentSteps = [
    { id: 'preflight', label: 'Pre-flight', icon: Shield },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'update', label: 'Provision', icon: Layers },
    { id: 'pull', label: 'Pulling', icon: Box },
    { id: 'restart', label: 'Deploy', icon: Rocket },
    { id: 'migrate', label: 'Schema', icon: Workflow },
    { id: 'health', label: 'Health', icon: Activity }
  ];

  const environments = [
    { id: 'dev', name: 'Development', icon: FlaskConical, color: 'bg-indigo-600', status: 'Healthy', version: 'v2.2.0-beta', region: 'US-East-1', host: 'dev.sparknode.io', provider: 'aws' },
    { id: 'qa', name: 'Staging / QA', icon: ClipboardCheck, color: 'bg-amber-500', status: 'Healthy', version: 'v2.1.1-rc', region: 'US-West-2', host: 'qa.sparknode.io', provider: 'azure' },
    { id: 'prod', name: 'Production', icon: ShieldCheck, color: 'bg-slate-900', status: 'Healthy', version: 'v2.1.0', region: 'AP-South-1', host: 'sparknode.io', provider: 'gcp' }
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
        
        if (data.log.includes('Checking connectivity')) setCurrentStep(0);
        if (data.log.includes('Backing up database')) setCurrentStep(1);
        if (data.log.includes('Initializing AWS') || data.log.includes('Terraform')) setCurrentStep(2);
        if (data.log.includes('Pulling images')) setCurrentStep(3);
        if (data.log.includes('Starting services')) setCurrentStep(4);
        if (data.log.includes('Running Alembic')) setCurrentStep(5);
        if (data.log.includes('Waiting for services')) setCurrentStep(6);

        if (data.log.includes('SUCCESS') || data.log.includes('Deployment complete')) {
           setDeployingEnvs({});
        }
      }
    };
    socket.onclose = () => setIsWebSocketConnected(false);
  };

  const triggerDeploy = async (env) => {
    setDeployingEnvs({ [env.id]: true });
    setCurrentStep(0);
    try {
      const resp = await fetch(`${API_BASE}/deployments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env_id: env.id, release_tag: 'latest', host: env.host, provider: env.provider
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
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 p-6">
        <div className="flex items-center gap-4 mb-10 px-2 text-slate-900">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Rocket className="text-white" size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SparkNode</h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cloud Ops</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-4">Core</p>
          <SidebarItem icon={LayoutGrid} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Server} label="Deployments" active={activeTab === 'environments'} onClick={() => setActiveTab('environments')} />
          <SidebarItem icon={History} label="History" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <SidebarItem icon={Database} label="Infrastructure" active={activeTab === 'db'} onClick={() => setActiveTab('db')} />
          <SidebarItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="mt-auto p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
             <div className={`w-2.5 h-2.5 rounded-full ${isWebSocketConnected ? 'bg-green-600 animate-pulse' : 'bg-slate-400'}`} />
             <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Connected</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">
            <span>Orchestrator</span>
            <ChevronRight size={18} className="text-slate-300" />
            <span className="text-slate-900">Active Environments</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-tight">Platform Admin</p>
                <p className="text-xs text-indigo-600 font-semibold">Super User</p>
             </div>
             <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base">PA</div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          <div className="mb-12">
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Target Environments</h2>
            <p className="text-slate-600 text-lg leading-relaxed max-w-3xl">
              Manage container cycles across multi-cloud regions using 
              <span className="text-indigo-600 font-bold px-1.5">Terraform</span> and automated image pipelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {environments.map((env) => (
              <EnvCard 
                key={env.id}
                {...env}
                deploying={deployingEnvs[env.id]}
                onDeploy={() => triggerDeploy(env)}
              />
            ))}
          </div>

          {activeDeployment && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                  <Activity size={18} className="text-indigo-600" /> Pipeline Progress
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
                      <span className={`text-xs font-bold uppercase tracking-wider text-center ${idx === currentStep ? 'text-indigo-700' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 bg-slate-900 rounded-2xl p-8 text-white flex flex-col min-h-[500px] shadow-xl border border-slate-800">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                      <Terminal size={24} className="text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">Deployment Logs</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs font-semibold uppercase tracking-widest">
                        <span className="text-indigo-400">Live Stream</span>
                        <span className="text-slate-500">ID: {activeDeployment.substring(0, 8)}</span>
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
                      <span className="text-slate-500 tabular-nums font-medium opacity-70">[{log.time}]</span>
                      <span className="break-all whitespace-pre-wrap">{log.msg}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                  {isWebSocketConnected && (
                    <div className="flex gap-3 pt-6 items-center text-xs font-bold text-indigo-400 uppercase tracking-widest">
                       <LucideRefreshCw size={14} className="animate-spin" />
                       <span>Processing release sequence...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
