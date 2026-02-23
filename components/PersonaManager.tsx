import React, { useState } from 'react';
import {
  Users, Plus, Target, UserCheck, Zap, Clock,
  X, PlusCircle, Trash2, BrainCircuit, ChevronRight,
  Settings2, Info, ToggleLeft, ToggleRight, CheckCircle2, Globe, Layout, Search
} from 'lucide-react';
import { Persona } from '../types';

interface PersonaManagerProps {
  personas: Persona[];
  activeProjectId: string;
  onAddPersona: (persona: Persona) => void;
  onUpdatePersona: (persona: Persona) => void;
}

const PersonaManager: React.FC<PersonaManagerProps> = ({ personas, activeProjectId, onAddPersona, onUpdatePersona }) => {
  console.log("PersonaManager Render:", { personas, activeProjectId });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [newPersona, setNewPersona] = useState<Partial<Persona>>({
    name: '',
    description: '',
    traits: [],
    skillLevel: 'Intermediate',
    speed: 'Moderate',
    goal: '',
    isActive: true,
    advancedLogic: [],
    projectId: activeProjectId // 초기값은 현재 프로젝트
  });
  const [traitInput, setTraitInput] = useState('');
  const [logicInput, setLogicInput] = useState('');

  const handleEditPersona = (persona: Persona) => {
    setNewPersona({ ...persona });
    setEditingPersonaId(persona.id);
    setShowCreateModal(true);
  };

  const handleToggleStatus = (e: React.MouseEvent, persona: Persona) => {
    e.stopPropagation();
    console.log("[PersonaManager] Toggling status for:", persona.name, "Current:", persona.isActive, "New:", !persona.isActive);
    onUpdatePersona({ ...persona, isActive: !persona.isActive });
  };

  const handleAddTrait = () => {
    if (!traitInput.trim()) return;
    setNewPersona(prev => ({
      ...prev,
      traits: [...(prev.traits || []), traitInput.trim()]
    }));
    setTraitInput('');
  };

  const handleAddLogic = () => {
    if (!logicInput.trim()) return;
    setNewPersona(prev => ({
      ...prev,
      advancedLogic: [...(prev.advancedLogic || []), logicInput.trim()]
    }));
    setLogicInput('');
  };

  const removeTrait = (index: number) => {
    setNewPersona(prev => ({
      ...prev,
      traits: (prev.traits || []).filter((_, i) => i !== index)
    }));
  };

  const removeLogic = (index: number) => {
    setNewPersona(prev => ({
      ...prev,
      advancedLogic: (prev.advancedLogic || []).filter((_, i) => i !== index)
    }));
  };

  const handleSavePersona = () => {
    if (!newPersona.name || !newPersona.goal) return;

    if (editingPersonaId) {
      onUpdatePersona(newPersona as Persona);
    } else {
      const persona: Persona = {
        id: `p_${Date.now()}`,
        projectId: newPersona.projectId || activeProjectId, // 선택된 Scope 반영
        name: newPersona.name!,
        description: newPersona.description || 'Custom defined user behavior agent.',
        traits: newPersona.traits || [],
        skillLevel: newPersona.skillLevel as any || 'Intermediate',
        speed: newPersona.speed as any || 'Moderate',
        goal: newPersona.goal!,
        isActive: true,
        advancedLogic: newPersona.advancedLogic || []
      };
      onAddPersona(persona);
    }

    setShowCreateModal(false);
    setEditingPersonaId(null);
    setNewPersona({
      name: '', description: '', traits: [],
      skillLevel: 'Intermediate', speed: 'Moderate',
      goal: '', isActive: true, advancedLogic: [],
      projectId: activeProjectId
    });
  };

  const filteredPersonas = personas.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.goal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1400px] mx-auto h-full overflow-y-auto custom-scrollbar flex flex-col">
      <div className="flex flex-col gap-4 mb-8">
        <p className="text-gray-500 dark:text-gray-400 text-sm italic font-medium">
          Define user behaviors for diverse exploratory testing scenarios.
        </p>
        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search personas by name, goal or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <button
            onClick={() => {
              setEditingPersonaId(null);
              setNewPersona({
                name: '', description: '', traits: [],
                skillLevel: 'Intermediate', speed: 'Moderate',
                goal: '', isActive: true, advancedLogic: [],
                projectId: activeProjectId
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl transition-all text-sm font-bold shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-5 h-5" />
            Create Persona
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredPersonas.map(p => (
          <div
            key={p.id}
            className={`bg-white dark:bg-[#16191f] border rounded-2xl p-6 transition-all flex flex-col group relative overflow-hidden shadow-sm dark:shadow-none ${p.isActive ? 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700' : 'border-red-200 dark:border-red-900/30 opacity-60 grayscale'
              }`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-3xl rounded-full pointer-events-none" />

            <div className="flex gap-6 mb-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all shadow-inner ${p.isActive ? 'bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white' : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-700'
                }`}>
                <UserCheck className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-lg truncate ${p.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>{p.name}</h3>
                    {p.projectId === 'global' ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                        <Globe className="w-2.5 h-2.5" /> Global
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[8px] font-black text-gray-500 uppercase tracking-widest">
                        <Layout className="w-2.5 h-2.5" /> Project
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleToggleStatus(e, p)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors relative z-10"
                    title={p.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {p.isActive ? <ToggleRight className="w-6 h-6 text-indigo-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400 dark:text-gray-700" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-4 h-8 line-clamp-2">{p.description}</p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400">
                    <Zap className="w-3 h-3 text-yellow-500" /> {p.skillLevel}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400">
                    <Clock className="w-3 h-3 text-indigo-400" /> {p.speed} Pace
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Behavioral Goal</div>
                <p className={`text-xs font-medium italic ${p.isActive ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>"{p.goal}"</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {p.traits.map((trait, idx) => (
                  <span key={idx} className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-800">
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase">
                {p.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                {p.isActive ? 'Ready for AI' : 'Inactive'}
              </div>
              <button
                onClick={() => handleEditPersona(p)}
                className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 uppercase tracking-widest flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20 transition-colors"
              >
                <Settings2 className="w-3 h-3" /> Modify & Logic
              </button>
            </div>
          </div>
        ))}

        <div
          onClick={() => {
            setEditingPersonaId(null);
            setNewPersona({
              name: '', description: '', traits: [],
              skillLevel: 'Intermediate', speed: 'Moderate',
              goal: '', isActive: true, advancedLogic: [],
              projectId: activeProjectId
            });
            setShowCreateModal(true);
          }}
          className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 group hover:border-indigo-500/50 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all cursor-pointer min-h-[220px]"
        >
          <BrainCircuit className="w-10 h-10 mb-2 opacity-20 group-hover:opacity-100 transition-all" />
          <p className="text-sm font-black uppercase tracking-widest">Initialize New Agent</p>
          <p className="text-[10px] mt-2 opacity-40 text-center">Define specific interaction vectors for AI</p>
        </div>
      </div>

      {/* CREATE/EDIT PERSONA MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm transition-colors" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] transition-colors">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] transition-colors">
                    {editingPersonaId ? 'Modify Persona Context' : 'Create Behavioral Persona'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Model interaction constraints & AI Logic</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {/* --- NEW: SCOPE SELECTION --- */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block">Persona Visibility (Scope)</label>
                <div className="flex bg-gray-50 dark:bg-[#0c0e12] p-1 rounded-xl border border-gray-200 dark:border-gray-800 gap-1 transition-colors">
                  <button
                    type="button"
                    onClick={() => setNewPersona({ ...newPersona, projectId: activeProjectId })}
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${newPersona.projectId !== 'global'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm dark:shadow-lg border border-gray-200 dark:border-gray-700'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                  >
                    <Layout className="w-3.5 h-3.5" /> Project Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPersona({ ...newPersona, projectId: 'global' })}
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${newPersona.projectId === 'global'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                  >
                    <Globe className="w-3.5 h-3.5" /> Global (All Projects)
                  </button>
                </div>
                <p className="text-[9px] text-gray-500 italic px-1">
                  {newPersona.projectId === 'global'
                    ? "• This persona will be available to all QA teams across the platform."
                    : "• This persona will be exclusive to the current active workspace."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Persona Name</label>
                  <input
                    type="text"
                    value={newPersona.name}
                    onChange={(e) => setNewPersona({ ...newPersona, name: e.target.value })}
                    placeholder="e.g., Power User"
                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Primary Objective (Goal)</label>
                  <input
                    type="text"
                    value={newPersona.goal}
                    onChange={(e) => setNewPersona({ ...newPersona, goal: e.target.value })}
                    placeholder="e.g., Finish checkout in under 1 minute"
                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Agent Description</label>
                <textarea
                  value={newPersona.description}
                  onChange={(e) => setNewPersona({ ...newPersona, description: e.target.value })}
                  placeholder="Provide context for the AI agent behavior..."
                  className="w-full h-20 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all resize-none placeholder:text-gray-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3 h-3 text-yellow-500" /> Digital Literacy
                  </label>
                  <div className="flex bg-gray-50 dark:bg-[#0c0e12] p-1 rounded-xl border border-gray-200 dark:border-gray-800 transition-colors">
                    {['Novice', 'Intermediate', 'Expert'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setNewPersona({ ...newPersona, skillLevel: level as any })}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${newPersona.skillLevel === level ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-800 dark:hover:text-gray-400'}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3 text-indigo-400" /> Interaction Speed
                  </label>
                  <div className="flex bg-gray-50 dark:bg-[#0c0e12] p-1 rounded-xl border border-gray-200 dark:border-gray-800 transition-colors">
                    {['Slow', 'Moderate', 'Fast'].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setNewPersona({ ...newPersona, speed: speed as any })}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${newPersona.speed === speed ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-800 dark:hover:text-gray-400'}`}
                      >
                        {speed}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Configure Logic Section: AI Heuristics */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-400" />
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Configure Logic (AI Heuristics)</label>
                  <div className="group relative">
                    <Info className="w-3 h-3 text-gray-600 cursor-help" />
                    <div className="absolute left-full ml-2 top-0 w-64 p-3 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      <p className="text-[10px] text-gray-400 leading-relaxed italic">
                        "이 로직은 AI 에이전트가 테스트를 수행할 때 지켜야 할 특수한 행동 강령입니다. 예: '결제 버튼을 누르기 전 반드시 약관 링크를 먼저 클릭할 것'"
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={logicInput}
                    onChange={(e) => setLogicInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLogic())}
                    placeholder="e.g., '모든 입력 폼에 XSS 페이로드를 먼저 시도할 것'"
                    className="flex-1 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none shadow-inner transition-colors placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleAddLogic}
                    className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 px-4 rounded-xl flex items-center justify-center transition-all border border-indigo-500/20"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {newPersona.advancedLogic?.map((logic, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 rounded-xl px-4 py-2 transition-colors">
                      <span className="text-xs text-indigo-600 dark:text-indigo-300 italic">"Always {logic}"</span>
                      <button onClick={() => removeLogic(idx)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {(!newPersona.advancedLogic || newPersona.advancedLogic.length === 0) && (
                    <div className="text-[10px] text-gray-500 italic px-2">No custom logic rules defined.</div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Behavioral Traits</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={traitInput}
                    onChange={(e) => setTraitInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTrait())}
                    placeholder="Add a trait (e.g., 'Careful reader')"
                    className="flex-1 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none shadow-inner transition-colors placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleAddTrait}
                    className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-white px-4 rounded-xl flex items-center justify-center transition-all border border-gray-200 dark:border-gray-700"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-inner transition-colors">
                  {newPersona.traits?.map((trait, idx) => (
                    <span key={idx} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase">
                      {trait}
                      <button onClick={() => removeTrait(idx)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 flex justify-end gap-4 transition-colors">
              <div className="flex items-center gap-3 mr-auto">
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-8 py-3 text-[10px] font-black text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePersona}
                disabled={!newPersona.name || !newPersona.goal}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-black px-10 py-3 rounded-xl uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                {editingPersonaId ? 'Update Persona' : 'Register Persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonaManager;
