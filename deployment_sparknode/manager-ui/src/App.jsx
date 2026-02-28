import React, { useState, useEffect, useRef } from 'react';
import { 
  Rocket, LayoutGrid, History, Settings, Database, Server, Activity, 
  Shield, Terminal, Play, RotateCcw, Workflow, Globe, MoreVertical,
  CheckCircle2, Search, Plus, ArrowUpRight, Box, Cpu, Unplug,
  FlaskConical, ClipboardCheck, ShieldCheck
} from 'lucide-react';

const API_BASE = 'http://localhost:8090/api';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      active 
        ? 'bg-indigo-50 text-indigo-600' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}
  >
    <Icon size={20} className={active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
    <span className="font-semibold text-sm">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.6)]" />}
  </button>
);

const EnvCard = ({ id, name, icon: Icon, color, status, version, region, onDeploy, deploying }) => (
  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 hover:shadow-xl hover:border-indigo-600/20 transition-all duration-500 group relative">
    <div className={`w-12 h-12 ${color} bg-opacity-10 rounded-2xl flex items-center justify-center mb-6`}>
      <Icon size={24} className={color.replace('bg-', 'text-')} />
    </div>
    
    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-block mb-4 ${
        status === 'Healthy' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
    }`}>
        {status}
    </div>
    
    <h4 className="text-2xl font-black text-slate-800 mb-1">{name}</h4>
    <p className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-wider flex items-center gap-1.5">
      <Globe size={12} /> {region}
    </p>

    <div className="space-y-4 mb-8">
      <div className="flex justify-between items-center text-sm font-medium">
        <span className="text-slate-400">Current Version</span>
        <span className="text-slate-800 font-mono font-bold bg-slate-50 px-2 rounded opacity-80">{version}</span>
      </div>
    </div>

    <button 
      onClick={onDeploy}
      disabled={deploying}
      className={`w-full flex items-center justify-center gap-2 ${color} text-white py-4 rounded-2xl font-black text-sm hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-${color.split('-')[1]}-600/20`}
    >
      {deploying ? (
        <RefreshCw className="animate-spin" size={16} />
      ) : (
        <Play size={16} fill="currentColor" />
      )}
      {deploying ? 'DEPLOYING...' : `DEPLOY TO ${id.toUpperCase()}`}
    </button>
  </div>
);

// Add RefreshCw for the button spin
const RefreshCw = ({ size, className }) => (
  <Activity size={size} className={className} />
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
    { id: 'preflight', label: 'PRE-FLIGHT', icon: Shield, desc: 'Connectivity & SSH Check' },
    { id: 'backup', label: 'BACKUP', icon: Database, desc: 'Database Snapshot' },
    { id: 'update', label: 'UPDATING', icon: Settings, desc: 'Writing .env config' },
    { id: 'pull', label: 'PULLING', icon: Box, desc: 'Fetching Docker Images' },
    { id: 'restart', label: 'LAUNCHING', icon: Rocket, desc: 'restarting containers' },
    { id: 'migrate', label: 'MIGRATING', icon: Workflow, desc: 'Alembic DB Upgrade' },
    { id: 'health', label: 'HEALTHY', icon: Activity, desc: 'Service Verification' }
  ];

  const environments = [
    { id: 'dev', name: 'Development', icon: FlaskConical, color: 'bg-indigo-600', status: 'Healthy', version: 'v2.2.0-beta', region: 'us-east-1', host: 'dev.sparknode.io' },
    { id: 'qa', name: 'Quality Assurance', icon: ClipboardCheck, color: 'bg-amber-500', status: 'Healthy', version: 'v2.1.1-rc', region: 'us-east-1', host: 'qa.sparknode.io' },
    { id: 'prod', name: 'Production', icon: ShieldCheck, color: 'bg-slate-900', status: 'Healthy', version: 'v2.1.0', region: 'ap-south-1', host: 'sparknode.io' }
  ];

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const connectToLogs = (deploymentId) => {
    if (socketRef.current) socketRef.current.close();
    setLogs([]);
    setActiveDeployment(deploymentId);

    const wsUrl = `ws://${window.location.hostname === 'localhost' ? 'localhost:8090' : window.location.host + '/api'}/ws/deployments/${deploymentId}/logs`;
    // Fallback for direct port access if needed
    const finalWsUrl = window.location.port ? `ws://${window.location.hostname}:8090/ws/deployments/${deploymentId}/logs` : wsUrl;
    
    const socket = new WebSocket(finalWsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsWebSocketConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.log) {
        setLogs(prev => [...prev, { 
          time: new Date().toLocaleTimeString(), 
          msg: data.log, 
          type: data.log.includes('ERROR') || data.log.includes('FAIL') ? 'warn' : 'info' 
        }]);
        
        // Dynamic Step Progression based on deploy.sh output
        if (data.log.includes('Checking connectivity')) setCurrentStep(0);
        if (data.log.includes('Backing up database')) setCurrentStep(1);
        if (data.log.includes('Updating APP_VERSION')) setCurrentStep(2);
        if (data.log.includes('Pulling images')) setCurrentStep(3);
        if (data.log.includes('Starting services')) setCurrentStep(4);
        if (data.log.includes('Running Alembic database migrations')) setCurrentStep(5);
        if (data.log.includes('Waiting for services to become healthy')) setCurrentStep(6);

        if (data.log.includes('✓ Deployment complete')) {
           setDeployingEnvs({});
        }
      }
    };

    socket.onclose = () => {
      setIsWebSocketConnected(false);
    };
  };

  const triggerDeploy = async (env) => {
    setDeployingEnvs({ [env.id]: true });
    try {
      const response = await fetch(`${API_BASE}/deployments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env_id: env.id,
          release_tag: 'latest',
          host: env.host,
          provider: 'aws'
        })
      });
      const data = await response.json();
      connectToLogs(data.deployment_id);
    } catch (err) {
      console.error(err);
      setDeployingEnvs({});
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      <aside className="w-72 bg-white border-r border-slate-100 flex flex-col p-6 shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Rocket className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-slate-900 leading-none">SparkNode</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mt-1.5">Control Plane</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <SidebarItem icon={LayoutGrid} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Server} label="Deployments" active={activeTab === 'environments'} onClick={() => setActiveTab('environments')} />
          <SidebarItem icon={History} label="Audit Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <SidebarItem icon={Database} label="Infrastructure" active={activeTab === 'db'} onClick={() => setActiveTab('db')} />
        </nav>

        <div className="mt-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
             <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">System Connection</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 py-4">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Deployment Manager</h2>
          <div className="flex items-center gap-3">
             <div className="text-right">
                <p className="text-sm font-bold text-slate-800">Platform Admin</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">super_user@sparknode.io</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold">PA</div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          <div className="mb-12">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Target Environments</h2>
            <p className="text-slate-500 font-medium italic">Triggering the automated deployment pipeline from deployment_sparknode/scripts/.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
            <div className="mt-12 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4 gap-4">
                {deploymentSteps.map((step, idx) => (
                  <div key={step.id} className="flex flex-col items-center gap-2 min-w-[100px]">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                      idx < currentStep ? 'bg-green-500 text-white' : 
                      idx === currentStep ? 'bg-indigo-600 text-white animate-pulse' : 
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {idx < currentStep ? <CheckCircle2 size={20} /> : <step.icon size={20} />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${idx === currentStep ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12">
             <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white flex flex-col min-h-[450px] shadow-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full" />
                
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                      <Terminal size={24} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">Active Script Output</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                        {activeDeployment ? `TRACING SCRIPT: ${activeDeployment}` : 'WAITING FOR SCRIPT TRIGGER...'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                    <span className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                      Live Output
                    </span>
                  </div>
                </div>

                <div className="font-mono text-sm space-y-3 flex-1 overflow-y-auto pr-4 custom-scrollbar relative z-10">
                   {logs.length === 0 && !isWebSocketConnected && (
                     <div className="h-full flex flex-col items-center justify-center opacity-30 mt-12">
                        <Unplug size={48} className="mb-4 text-slate-500" />
                        <p className="font-bold uppercase tracking-[0.2em] text-xs">No active script execution</p>
                     </div>
                   )}
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4 group hover:bg-white/5 p-1 rounded transition-colors border-l-2 border-transparent hover:border-blue-500">
                      <span className="text-slate-600 shrink-0 font-medium opacity-50">[{log.time}]</span>
                      <span className={`${log.type === 'warn' ? 'text-amber-300' : 'text-slate-200'}`}>{log.msg}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                  {isWebSocketConnected && (
                    <div className="flex gap-4 animate-pulse pt-2 items-center">
                       <Workflow size={14} className="text-blue-400 animate-spin" />
                       <span className="text-blue-400 font-bold text-xs uppercase tracking-widest">Script Running...</span>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
