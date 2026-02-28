import React, { useState, useEffect, useRef } from 'react';
import { 
  Rocket, LayoutGrid, History, Settings, Database, Server, Activity, 
  Shield, Terminal, Play, RotateCcw, Workflow, Globe, MoreVertical,
  CheckCircle2, Search, Plus, ArrowUpRight, Box, Cpu, Unplug
} from 'lucide-react';

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

const MetricCard = ({ label, value, trend, icon: Icon, color }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div className={`p-2.5 rounded-xl ${color} bg-opacity-10`}>
        <Icon size={22} className={color.replace('bg-', 'text-')} />
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold ${trend > 0 ? 'text-green-500' : 'text-slate-400'}`}>
        {trend > 0 && <ArrowUpRight size={14} />}
        {trend}%
      </div>
    </div>
    <div className="mt-4">
      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <h3 className="text-2xl font-black text-slate-800 mt-1">{value}</h3>
    </div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('environments');
  const [logs, setLogs] = useState([]);
  const [activeDeployment, setActiveDeployment] = useState(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const logEndRef = useRef(null);
  const socketRef = useRef(null);

  const environments = [
    { id: 'prod-main', name: 'Production', status: 'Healthy', version: 'v2.1.0', region: 'ap-south-1', tier: 'Enterprise', uptime: '99.98%' },
    { id: 'staging-01', name: 'Staging', status: 'Healthy', version: 'v2.1.1-rc', region: 'us-east-1', tier: 'Pro', uptime: '99.4%' },
    { id: 'dev-sandbox', name: 'Development', status: 'Warning', version: 'v2.2.0-beta', region: 'us-east-1', tier: 'Free', uptime: '97.2%' }
  ];

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const connectToLogs = (deploymentId) => {
    if (socketRef.current) socketRef.current.close();
    
    setLogs([{ time: new Date().toLocaleTimeString(), msg: `Initiating connection to ${deploymentId}...`, type: 'info' }]);
    setActiveDeployment(deploymentId);

    // Dynamic WebSocket URL based on deployment ID
    const wsUrl = `ws://${window.location.hostname}:8080/ws/deployments/${deploymentId}/logs`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsWebSocketConnected(true);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'Connected to Control Plane Log Stream.', type: 'info' }]);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.log) {
        setLogs(prev => [...prev, { 
          time: new Date().toLocaleTimeString(), 
          msg: data.log, 
          type: data.log.includes('ERROR') || data.log.includes('FAIL') ? 'warn' : 'info' 
        }]);
      }
    };

    socket.onclose = () => {
      setIsWebSocketConnected(false);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'Connection lost. Listening for new deployments...', type: 'warn' }]);
    };
  };

  const triggerDeploy = async (envId) => {
    const mockDeploymentId = `dep-${Math.random().toString(36).substr(2, 9)}`;
    connectToLogs(mockDeploymentId);
    
    // In a real scenario, we'd POST to /deployments/ to start the Celery task
    // For now, we simulate the trigger. The Backend (main.py + execution_engine.py) 
    // is already coded to handle this via Redis Pub/Sub if it were running.
    console.log(`Backend Triggered: /api/deployments/${envId}`);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      {/* Sidebar */}
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
          <SidebarItem icon={Server} label="Environments" active={activeTab === 'environments'} onClick={() => setActiveTab('environments')} />
          <SidebarItem icon={History} label="Deployment Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <SidebarItem icon={Database} label="Postgres Clusters" active={activeTab === 'db'} onClick={() => setActiveTab('db')} />
          <SidebarItem icon={Activity} label="Health Monitoring" active={activeTab === 'health'} onClick={() => setActiveTab('health')} />
        </nav>

        <div className="mt-auto space-y-2">
          <SidebarItem icon={Settings} label="Manager Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-xs font-bold text-slate-600">WS Connection: {isWebSocketConnected ? 'LIVE' : 'IDLE'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
             <div className="relative w-full group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search infrastructure..." className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" />
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-right">
                <p className="text-sm font-bold text-slate-800">Platform Admin</p>
                <p className="text-[10px] text-slate-400 font-bold">super_user@sparknode.io</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold">PA</div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-10">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 mb-1 font-black uppercase tracking-widest text-[10px]">
                <Shield size={16} /> Verified Secure Plane
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Environments</h2>
            </div>
            <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-indigo-600/30 hover:-translate-y-0.5 transition-all">
              <Plus size={18} /> PROVISION NEW CLUSTER
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <MetricCard label="Total Nodes" value="12" trend={12} icon={Cpu} color="bg-indigo-600" />
            <MetricCard label="Active Deployments" value={activeDeployment ? "1" : "0"} trend={0} icon={Workflow} color="bg-blue-500" />
            <MetricCard label="Avg Response" value="142ms" trend={-4} icon={Activity} color="bg-amber-500" />
            <MetricCard label="Storage" value="38%" trend={2} icon={Box} color="bg-emerald-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {environments.map((env) => (
              <div key={env.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 hover:shadow-xl hover:border-indigo-600/20 transition-all duration-500 group relative">
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-block mb-8 ${
                    env.status === 'Healthy' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                }`}>
                    {env.status}
                </div>
                <h4 className="text-2xl font-black text-slate-800 mb-1">{env.name}</h4>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-8 uppercase tracking-wider">
                  <Globe size={12} /> {env.region} • {env.tier}
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-400">Version</span>
                    <span className="text-slate-800 font-mono font-bold bg-slate-50 px-2 rounded opacity-80">{env.version}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-400">Service Uptime</span>
                    <span className="text-slate-700 font-bold">{env.uptime}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => triggerDeploy(env.id)}
                    className="flex items-center justify-center gap-2 bg-slate-900 text-white py-3.5 rounded-2xl font-black text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                  >
                    <Play size={14} fill="currentColor" /> DEPLOY
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-white border border-slate-100 py-3.5 rounded-2xl font-black text-xs text-slate-600 hover:bg-slate-50 transition-all">
                    <RotateCcw size={14} /> ROLLBACK
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12">
             <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white flex flex-col min-h-[450px] shadow-2xl border border-white/5 relative overflow-hidden">
                {/* Visual Accent */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full" />
                
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                      <Terminal size={24} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">Deployment Stream</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        {activeDeployment ? `TRACING: ${activeDeployment}` : 'WAITING FOR TASK ID...'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                    <span className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      {isWebSocketConnected ? 'Live Connection' : 'Socket Idle'}
                    </span>
                  </div>
                </div>

                <div className="font-mono text-sm space-y-3 flex-1 overflow-y-auto pr-4 custom-scrollbar relative z-10">
                   {logs.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <Unplug size={48} className="mb-4 text-slate-500" />
                        <p className="font-bold uppercase tracking-[0.2em] text-xs">No active streams detected</p>
                     </div>
                   )}
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4 group hover:bg-white/5 p-1 rounded transition-colors">
                      <span className="text-slate-600 shrink-0 font-medium opacity-50">[{log.time}]</span>
                      <span className={`${log.type === 'warn' ? 'text-amber-300' : 'text-slate-200'}`}>{log.msg}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                  {isWebSocketConnected && (
                    <div className="flex gap-4 animate-pulse pt-2">
                       <span className="text-slate-600 shrink-0 font-medium">[{new Date().toLocaleTimeString()}]</span>
                       <span className="text-blue-400 font-bold">Waiting for CI payload...</span>
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
