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

const ConfigModal = ({ provider, onClose, onConfirm, envName, region: envRegion }) => {
  const [deploymentMode, setDeploymentMode] = useState('new'); // 'new' | 'update'
  const [formData, setFormData] = useState({
    connection_id: '',
    node_class: 'burstable',
    region: envRegion || (provider === 'aws' ? 'us-east-1' : provider === 'azure' ? 'eastus' : 'us-central1')
  });
  
  const [connections, setConnections] = useState([]);
  const [status, setStatus] = useState('idle'); // idle -> validated -> reviewed -> approved
  const [reviewData, setReviewData] = useState(null);
  const [error, setError] = useState(null);
  const [deploymentId, setDeploymentId] = useState(null);

  useEffect(() => {
    if (deploymentMode === 'update') {
      const fetchLastConfig = async () => {
        try {
          const resp = await fetch(`${API_BASE}/infra/config?env_id=${envName}&provider=${provider}`);
          const data = await resp.json();
          if (data && data.variables) {
            setFormData(prev => ({...prev, ...data.variables}));
          }
        } catch (e) { console.error("Failed to fetch last config", e); }
      };
      fetchLastConfig();
    }
  }, [deploymentMode, envName, provider]);

  const regions = {
    aws: [
      { id: 'us-east-1', label: 'East US (Virginia)' },
      { id: 'ap-south-1', label: 'South India (Mumbai)' },
      { id: 'eu-west-1', label: 'West Europe (Ireland)' }
    ],
    azure: [
      { id: 'eastus', label: 'East US' },
      { id: 'southindia', label: 'South India' },
      { id: 'westeurope', label: 'West Europe' }
    ],
    gcp: [
      { id: 'us-east1', label: 'East US (South Carolina)' },
      { id: 'asia-south1', label: 'South India (Mumbai)' },
      { id: 'europe-west1', label: 'West Europe (Belgium)' }
    ]
  };

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const resp = await fetch(`${API_BASE}/infra/connections`);
        const data = await resp.json();
        setConnections(data.filter(c => c.provider.toLowerCase() === provider.toLowerCase()));
      } catch (e) { console.error("Failed to fetch connections", e); }
    };
    fetchConnections();
  }, [provider]);

  const handleValidate = async () => {
    if (!formData.connection_id) return setError("Please select a Cloud Connection Profile");
    setStatus('validating');
    try {
      const resp = await fetch(`${API_BASE}/infra/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env_id: envName, provider, config: formData })
      });
      if (!resp.ok) throw new Error("IAM Permission Validation FAILED");
      setStatus('validated');
      setError(null);
    } catch (e) {
      setError(e.message);
      setStatus('idle');
    }
  };

  const handleReview = async () => {
    setStatus('reviewing');
    try {
      const resp = await fetch(`${API_BASE}/infra/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          env_id: envName, 
          provider, 
          config: formData,
          mode: deploymentMode 
        })
      });
      const data = await resp.json();
      
      // Critical Issue #3: Injected Risk level into mock
      const mockReview = {
        ...data.plan,
        risk: 'green',
        cost: '$84/month',
        time: '6 minutes'
      };
      
      setReviewData(mockReview);
      setDeploymentId(data.deployment_id);
      setStatus('reviewed');
    } catch (e) {
      setError(e.message);
      setStatus('validated');
    }
  };

  const handleApprove = async () => {
    setStatus('approving');
    try {
      await fetch(`${API_BASE}/infra/approve?deployment_id=${deploymentId}`, {
        method: 'POST'
      });
      onConfirm(formData);
    } catch (e) {
      setError(e.message);
      setStatus('reviewed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header Context (Issue #4) */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
              <Layers size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-0.5">
                <span>{provider} INFRASTRUCTURE PIPELINE</span>
                <span className="text-slate-300">•</span>
                <span>{envName}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Provision Foundation</h3>
            </div>
          </div>
          <div className="flex gap-6 text-right mr-8">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Region</p>
              <p className="text-xs font-bold text-slate-700">{envRegion || 'Not Set'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">State</p>
              <p className="text-xs font-bold text-green-600">NEW_PROVISION</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-12 overflow-hidden" style={{ height: '550px' }}>
          {/* Step 1: Configuration (Issue #1, #5) */}
          <div className="col-span-4 p-8 border-r border-slate-100 space-y-8 bg-white overflow-y-auto">
            <section>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Settings size={14} className="text-indigo-500" /> Action Type
              </h4>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setDeploymentMode('new')}
                  className={`py-2 text-[10px] font-bold rounded-lg transition-all ${deploymentMode === 'new' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >CREATE NEW</button>
                <button 
                  onClick={() => setDeploymentMode('update')}
                  className={`py-2 text-[10px] font-bold rounded-lg transition-all ${deploymentMode === 'update' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >UPDATE INFRA</button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 italic">
                {deploymentMode === 'new' ? 'Targeted: Provision VM components only.' : 'Full: Sync all environment foundation state.'}
              </p>
            </section>

            <section>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Shield size={14} className="text-indigo-500" /> Connection Profile
              </h4>
              <select 
                value={formData.connection_id}
                onChange={e => setFormData({...formData, connection_id: e.target.value})}
                disabled={status !== 'idle'}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
              >
                <option value="">Select Account Connection...</option>
                {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {connections.length === 0 && <option value="mock">Injected Provider Keys (From .env)</option>}
              </select>
              <p className="text-[10px] text-slate-400 mt-2 italic">Credentials are referenced via Profile ID for audit compliance.</p>
            </section>

            <section>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Globe size={14} className="text-indigo-500" /> Deployment Region
              </h4>
              <select 
                value={formData.region}
                onChange={e => setFormData({...formData, region: e.target.value})}
                disabled={status !== 'idle'}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none mb-2"
              >
                {regions[provider.toLowerCase()].map(r => (
                  <option key={r.id} value={r.id}>{r.label} ({r.id})</option>
                ))}
              </select>
            </section>

            <section>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Node Class Selection</h4>
              <div className="space-y-3">
                 <button 
                   onClick={() => setFormData({...formData, node_class: 'burstable'})}
                   className={`w-full p-4 rounded-xl border-2 text-left transition-all ${formData.node_class === 'burstable' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                 >
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-black text-slate-900 text-sm">Burstable</p>
                      <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100">t3.medium</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Suitable for dev/test environments. Uses shared CPU credits.</p>
                 </button>

                 <button 
                   onClick={() => setFormData({...formData, node_class: 'production'})}
                   className={`w-full p-4 rounded-xl border-2 text-left transition-all ${formData.node_class === 'production' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                 >
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-black text-slate-900 text-sm">Production Optimized</p>
                      <span className="text-[10px] font-bold text-green-600 bg-white px-2 py-0.5 rounded border border-green-100">m6i.large</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Dedicated performance cores with high-availability networking.</p>
                 </button>
              </div>
            </section>
          </div>

          {/* Step 2: Plan Review (Issue #2, #3) */}
          <div className="col-span-8 bg-slate-50 p-8 overflow-y-auto">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Workflow size={14} className="text-indigo-500" /> Terraform Execution Plan
            </h4>
            
            {reviewData ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1">To Add</p>
                    <p className="text-2xl font-black text-green-600">+{reviewData.resources_to_add}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center opacity-40">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Modify</p>
                    <p className="text-2xl font-black text-slate-900">0</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Impact</p>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-black text-green-700">SAFE</span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Est. Cost</p>
                    <p className="text-sm font-black text-slate-800 mt-1.5">{reviewData.cost}</p>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Planned Resources</p>
                    <span className="text-[10px] text-slate-500 font-mono">Provision Time: ~{reviewData.time}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-[11px]">
                    {reviewData.resources.map(r => (
                      <div key={r} className="flex gap-3 items-center text-slate-300">
                        <span className="text-green-500 opacity-80">+</span> {r}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                   <ShieldCheck size={20} className="text-indigo-600 mt-0.5" />
                   <div>
                     <p className="text-xs font-bold text-indigo-900">Governance & Approval</p>
                     <p className="text-[10px] text-indigo-700 mt-1 leading-relaxed">This plan has been analyzed for risk. Proceeding will record an approval event for Environment {envName}.</p>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6">
                  <RotateCcw className="text-slate-200 animate-spin-slow" size={48} />
                </div>
                <h5 className="text-slate-800 font-bold mb-2">Awaiting Generation</h5>
                <p className="text-xs text-slate-500 max-w-sm">Complete the configuration and validate connection to generate the destructive execution plan.</p>
              </div>
            )}
            {error && <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-black">{error}</div>}
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
          <button onClick={onClose} className="px-8 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all">Cancel</button>
          
          <div className="flex gap-3">
             <button 
               onClick={handleValidate}
               disabled={status !== 'idle' && status !== 'validated'}
               className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                 status === 'validated' || status === 'reviewed' 
                 ? 'bg-green-600 text-white shadow-lg shadow-green-100' 
                 : 'bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100'
               }`}
             >
               {status === 'validating' ? <LucideRefreshCw className="animate-spin" size={16} /> : (status === 'validated' || status === 'reviewed' ? <CheckCircle2 size={16} /> : <Shield size={16} />)}
               {status === 'validated' || status === 'reviewed' ? 'Identity Verified' : 'Validate Access'}
             </button>

             <button 
               onClick={handleReview}
               disabled={status !== 'validated' && status !== 'reviewed'}
               className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                 status === 'reviewed' 
                 ? 'bg-white border-2 border-indigo-600 text-indigo-700' 
                 : 'bg-slate-100 text-slate-400 cursor-not-allowed'
               }`}
             >
               {status === 'reviewing' ? <LucideRefreshCw className="animate-spin" size={16} /> : <Workflow size={16} />}
               {status === 'reviewed' ? 'Plan Generated' : 'Analyze Plan'}
             </button>

             <button 
               onClick={handleApprove}
               disabled={status !== 'reviewed'}
               className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed group flex items-center gap-2"
             >
               {status === 'approving' ? <LucideRefreshCw className="animate-spin" size={16} /> : <Rocket size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
               Final Approve & Provision
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EnvCard = ({ id, name, icon: Icon, color, status, version, region, onDeployInfra, onDeployApp, onRollback, deploying, host, showMetrics = true }) => {
  const [metrics, setMetrics] = useState({ cpu: '0%', mem: '0MB', latency: '0ms' });

  useEffect(() => {
    if (!showMetrics) return;
    // Mock Prometheus metrics polling
    const interval = setInterval(() => {
      setMetrics({
        cpu: `${Math.floor(Math.random() * 15 + 2)}%`,
        mem: `${Math.floor(Math.random() * 200 + 400)}MB`,
        latency: `${Math.floor(Math.random() * 40 + 10)}ms`
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [showMetrics]);

  return (
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

      {/* Utilization Metrics Strip - Only shown on Dashboard */}
      {showMetrics && (
        <div className="px-6 py-4 bg-slate-50/50 border-y border-slate-100 grid grid-cols-3 gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CPU Usage</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">{metrics.cpu}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memory</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">{metrics.mem}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prometheus Lag</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">{metrics.latency}</span>
          </div>
        </div>
      )}

      <div className="px-6 py-5 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-slate-600 text-xs text-slate-400 uppercase tracking-widest">Phase 1: Foundation</span>
          <span className={`font-mono font-bold px-2 py-0.5 rounded border text-[10px] ${
            status === 'Healthy' ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-slate-400 bg-slate-50 border-slate-200'
          }`}>
            {status === 'Healthy' ? 'PROVISIONED' : 'PENDING'}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm text-xs">
          <span className="font-medium text-slate-600 text-slate-400 uppercase tracking-widest">Phase 2: Containers</span>
          <span className={`font-mono font-bold px-2 py-0.5 rounded border text-[10px] ${
            status === 'Healthy' ? 'text-green-700 bg-green-50 border-green-100' : 'text-slate-400 bg-slate-50 border-slate-200'
          }`}>
            {status === 'Healthy' ? version : 'SHADOWED'}
          </span>
        </div>
      </div>

      {!showMetrics && (
        <div className="p-6 pt-0 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={onDeployInfra}
              disabled={deploying}
              className="flex items-center justify-center gap-2 px-3 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md hover:bg-slate-900 transition-all disabled:opacity-50"
            >
              {deploying ? <LucideRefreshCw className="animate-spin" size={12} /> : <Layers size={14} />}
              Deploy Infra
            </button>
            <button 
              onClick={onDeployApp}
              disabled={deploying || status !== 'Healthy'}
              className={`flex items-center justify-center gap-2 px-3 py-3 ${color} text-white rounded-xl font-bold text-xs shadow-md hover:opacity-95 transition-all disabled:opacity-50`}
            >
              {deploying ? <LucideRefreshCw className="animate-spin" size={12} /> : <Rocket size={14} />}
              Deploy SparkNode
            </button>
          </div>
          
          <button 
            onClick={onRollback}
            disabled={deploying}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 rounded-xl font-bold text-xs disabled:opacity-50 transition-all font-mono"
          >
            <RotateCcw size={14} /> ROLLBACK / DESTROY
          </button>
        </div>
      )}
    </div>
  );
};

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
        if (data.log.includes('SKIP_TERRAFORM')) setCurrentStep(3);
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

  const executeDeployment = async (env, config = {}, skipInfra = false) => {
    setDeployingEnvs({ [env.id]: true });
    setCurrentStep(skipInfra ? 3 : 0); // Start at "App Containers" if skipping infra
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
          config: config,
          skip_infra: skipInfra // New flag to backend
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
          envName={configModal.id}
          region={configModal.region}
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
          <SidebarItem icon={Rocket} label="Deploy SparkNode" active={activeTab === 'environments'} onClick={() => setActiveTab('environments')} />
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
            <span className="text-slate-900">{activeTab === 'environments' ? 'Deploy SparkNode' : 'Dashboard'}</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base">SA</div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'environments' ? (
            <>
              <div className="mb-12">
                <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Provision & Deploy</h2>
                <p className="text-slate-600 text-lg leading-relaxed max-w-3xl">
                  Automated workflow to provision <span className="text-indigo-600 font-bold underline decoration-indigo-200 underline-offset-4">Physical Infrastructure</span> 
                  and deploy <span className="text-indigo-600 font-bold underline decoration-indigo-200 underline-offset-4 px-1">Frontend & Backend</span> containers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {environments.map((env) => (
                  <EnvCard 
                    key={env.id}
                    {...env}
                    showMetrics={false}
                    deploying={deployingEnvs[env.id]}
                    onDeployInfra={() => setConfigModal(env)}
                    onDeployApp={() => executeDeployment(env, {}, true)} // Skip TF step
                    onRollback={() => triggerRollback(env)}
                  />
                ))}
              </div>

              <div className="mt-12">
                {!activeDeployment ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm flex flex-col items-center justify-center text-center opacity-60">
                    <Rocket size={48} className="text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">Deployment Pipeline Ready</h3>
                    <p className="text-slate-500 text-sm max-w-sm mt-2 font-medium">
                      Select a provider above to begin the Terraform provisioning and container rollout sequence.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm scale-in-center">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                        <Activity size={18} className="text-indigo-600" /> Infrastructure & Container Rollout
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
                            <h3 className="text-lg font-bold tracking-tight">Deployment Logs</h3>
                            <div className="flex items-center gap-3 mt-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
                              <span className="opacity-70">Physical Provisioning in Progress</span>
                              <span className="text-slate-600">|</span>
                              <span className="animate-pulse">Live</span>
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
            </>
          ) : (
            <>
              <div className="mb-12">
                <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Health & Utilization</h2>
                <p className="text-slate-600 text-lg leading-relaxed max-w-3xl">
                  Real-time telemetry and resource usage for all <span className="text-indigo-600 font-bold px-1">active</span> SparkNode instances.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {environments.filter(e => e.status === 'Active').map((env) => (
                  <EnvCard 
                    key={env.id}
                    {...env}
                    showMetrics={true}
                    onDeploy={() => setConfigModal(env)}
                    onRollback={() => triggerRollback(env)}
                  />
                ))}
                {environments.filter(e => e.status === 'Active').length === 0 && (
                   <div className="col-span-full py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
                      <Activity size={48} className="text-slate-300 mb-4" />
                      <h3 className="text-lg font-bold text-slate-800">No Active Nodes</h3>
                      <p className="text-slate-500 text-sm max-w-xs mt-2">
                        Metrics will appear here once you've successfully deployed an environment via the 'Deploy SparkNode' tab.
                      </p>
                   </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
