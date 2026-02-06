import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import {
  ArrowLeft,
  Sparkles,
  FolderPlus,
  Code,
  Terminal,
  BookOpen,
  Server,
  Smartphone,
  Package,
  Check,
  ChevronRight,
  Loader2,
  X,
  Plus,
} from 'lucide-react';
import type { NewProjectSpec } from '../types/gastown';
import SpeechInput from '../components/SpeechInput';

type ProjectType = 'web' | 'cli' | 'library' | 'api' | 'desktop' | 'mobile' | 'other';
type WizardStep = 'describe' | 'type' | 'stack' | 'features' | 'review' | 'creating';

const PROJECT_TYPES: { type: ProjectType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: 'web', label: 'Web App', icon: <Code size={24} />, description: 'Frontend or full-stack web application' },
  { type: 'cli', label: 'CLI Tool', icon: <Terminal size={24} />, description: 'Command-line interface application' },
  { type: 'library', label: 'Library', icon: <Package size={24} />, description: 'Reusable package or module' },
  { type: 'api', label: 'API Service', icon: <Server size={24} />, description: 'REST or GraphQL backend service' },
  { type: 'desktop', label: 'Desktop App', icon: <BookOpen size={24} />, description: 'Electron or native desktop application' },
  { type: 'mobile', label: 'Mobile App', icon: <Smartphone size={24} />, description: 'iOS, Android, or cross-platform mobile' },
  { type: 'other', label: 'Other', icon: <FolderPlus size={24} />, description: 'Custom project type' },
];

const COMMON_TECH_STACKS: Record<ProjectType, string[]> = {
  web: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Next.js', 'Vue', 'Svelte', 'Angular'],
  cli: ['Node.js', 'TypeScript', 'Go', 'Rust', 'Python', 'Commander.js', 'Inquirer.js'],
  library: ['TypeScript', 'Jest', 'ESLint', 'Rollup', 'Vitest', 'tsup'],
  api: ['Node.js', 'Express', 'Fastify', 'NestJS', 'Hono', 'PostgreSQL', 'MongoDB', 'Redis', 'Prisma'],
  desktop: ['Electron', 'React', 'TypeScript', 'Tauri', 'Rust'],
  mobile: ['React Native', 'Expo', 'TypeScript', 'Flutter', 'Dart', 'Swift', 'Kotlin'],
  other: ['TypeScript', 'Node.js', 'Python', 'Go', 'Rust'],
};

export default function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('describe');
  const [isListening, setIsListening] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('web');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [customTech, setCustomTech] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [targetPath, setTargetPath] = useState('');

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSpeechTranscript = (transcript: string) => {
    if (step === 'describe') {
      setDescription(prev => prev + ' ' + transcript);
    } else if (step === 'features') {
      setNewFeature(transcript);
    }
  };

  const handleSpeechFinal = (transcript: string) => {
    if (step === 'describe') {
      // Try to extract name from description
      const words = transcript.trim().split(' ');
      if (words.length > 0 && !name) {
        // Use first few words as potential name
        const potentialName = words.slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (potentialName.length > 2) {
          setName(potentialName);
        }
      }
    }
  };

  const toggleTech = (tech: string) => {
    setTechStack(prev =>
      prev.includes(tech)
        ? prev.filter(t => t !== tech)
        : [...prev, tech]
    );
  };

  const addCustomTech = () => {
    if (customTech.trim() && !techStack.includes(customTech.trim())) {
      setTechStack(prev => [...prev, customTech.trim()]);
      setCustomTech('');
    }
  };

  const addFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      setFeatures(prev => [...prev, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (feature: string) => {
    setFeatures(prev => prev.filter(f => f !== feature));
  };

  const browseForPath = async () => {
    const path = await api.browseForProject();
    if (path) {
      setTargetPath(path);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 'describe':
        return name.trim().length > 0 && description.trim().length > 0;
      case 'type':
        return true; // Type has a default
      case 'stack':
        return techStack.length > 0;
      case 'features':
        return true; // Features are optional
      case 'review':
        return targetPath.trim().length > 0;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const steps: WizardStep[] = ['describe', 'type', 'stack', 'features', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: WizardStep[] = ['describe', 'type', 'stack', 'features', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const createProject = async () => {
    setIsCreating(true);
    setStep('creating');
    setError(null);

    const spec: NewProjectSpec = {
      name: name.trim(),
      description: description.trim(),
      type: projectType,
      techStack,
      features,
    };

    try {
      const result = await api.scaffoldNewProject(targetPath, spec);

      if (result.success) {
        // Add the project to the list
        await api.addProject(`${targetPath}/${name}`);
        navigate('/projects');
      } else {
        setError(result.error || 'Failed to create project');
        setStep('review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('review');
    } finally {
      setIsCreating(false);
    }
  };

  const renderStepIndicator = () => {
    const steps: { key: WizardStep; label: string }[] = [
      { key: 'describe', label: 'Describe' },
      { key: 'type', label: 'Type' },
      { key: 'stack', label: 'Stack' },
      { key: 'features', label: 'Features' },
      { key: 'review', label: 'Review' },
    ];

    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, index) => {
          const isActive = s.key === step;
          const isPast = steps.findIndex(x => x.key === step) > index;

          return (
            <div key={s.key} className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${isActive ? 'bg-purple-500 text-white' : ''}
                  ${isPast ? 'bg-green-500 text-white' : ''}
                  ${!isActive && !isPast ? 'bg-slate-700 text-slate-400' : ''}
                `}
              >
                {isPast ? <Check size={16} /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <ChevronRight size={16} className="mx-1 text-slate-600" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDescribeStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Project Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-awesome-project"
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Description
        </label>
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your project in detail. What problem does it solve? Who is it for? What are the main features?"
            rows={5}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 resize-none"
          />
          <div className="absolute bottom-3 right-3">
            <SpeechInput
              onTranscript={handleSpeechTranscript}
              onFinalTranscript={handleSpeechFinal}
              onListeningChange={setIsListening}
              className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
            />
          </div>
        </div>
        {isListening && (
          <p className="text-sm text-purple-400 mt-2 animate-pulse">
            Listening... Speak your project description
          </p>
        )}
      </div>
    </div>
  );

  const renderTypeStep = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {PROJECT_TYPES.map(({ type, label, icon, description }) => (
        <button
          key={type}
          onClick={() => {
            setProjectType(type);
            // Pre-select common tech for the type
            if (techStack.length === 0) {
              setTechStack(COMMON_TECH_STACKS[type].slice(0, 3));
            }
          }}
          className={`
            p-4 rounded-lg border-2 text-left transition-all
            ${projectType === type
              ? 'border-purple-500 bg-purple-500/20'
              : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'}
          `}
        >
          <div className={`mb-2 ${projectType === type ? 'text-purple-400' : 'text-slate-400'}`}>
            {icon}
          </div>
          <h3 className="font-medium text-white mb-1">{label}</h3>
          <p className="text-xs text-slate-400">{description}</p>
        </button>
      ))}
    </div>
  );

  const renderStackStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Suggested for {PROJECT_TYPES.find(t => t.type === projectType)?.label}
        </h3>
        <div className="flex flex-wrap gap-2">
          {COMMON_TECH_STACKS[projectType].map(tech => (
            <button
              key={tech}
              onClick={() => toggleTech(tech)}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${techStack.includes(tech)
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
              `}
            >
              {tech}
              {techStack.includes(tech) && <Check size={14} className="inline ml-1" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">Selected Stack</h3>
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          {techStack.length === 0 ? (
            <p className="text-sm text-slate-500">No technologies selected yet</p>
          ) : (
            techStack.map(tech => (
              <span
                key={tech}
                className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-1"
              >
                {tech}
                <button
                  onClick={() => toggleTech(tech)}
                  className="hover:text-purple-100"
                >
                  <X size={14} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">Add Custom</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={customTech}
            onChange={(e) => setCustomTech(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomTech()}
            placeholder="Add other technology..."
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={addCustomTech}
            disabled={!customTech.trim()}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderFeaturesStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Key Features (optional)
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          List the main features your project should have. The Controller will use these to scaffold the project structure.
        </p>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFeature()}
              placeholder="e.g., User authentication, Dark mode, API integration..."
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <SpeechInput
                onTranscript={(t) => setNewFeature(t)}
                onFinalTranscript={addFeature}
                onListeningChange={setIsListening}
                className="p-1.5 bg-slate-600 hover:bg-slate-500 rounded transition-colors"
              />
            </div>
          </div>
          <button
            onClick={addFeature}
            disabled={!newFeature.trim()}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Add
          </button>
        </div>

        <div className="space-y-2">
          {features.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No features added yet. This is optional - you can add them later.
            </p>
          ) : (
            features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-2 bg-slate-700/50 rounded-lg"
              >
                <span className="text-white">{feature}</span>
                <button
                  onClick={() => removeFeature(feature)}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
          {error}
        </div>
      )}

      <div className="bg-slate-700/50 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-sm text-slate-400 mb-1">Project Name</h3>
          <p className="text-lg font-medium text-white">{name}</p>
        </div>

        <div>
          <h3 className="text-sm text-slate-400 mb-1">Description</h3>
          <p className="text-white">{description}</p>
        </div>

        <div>
          <h3 className="text-sm text-slate-400 mb-1">Type</h3>
          <p className="text-white">
            {PROJECT_TYPES.find(t => t.type === projectType)?.label}
          </p>
        </div>

        <div>
          <h3 className="text-sm text-slate-400 mb-1">Tech Stack</h3>
          <div className="flex flex-wrap gap-2">
            {techStack.map(tech => (
              <span
                key={tech}
                className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {features.length > 0 && (
          <div>
            <h3 className="text-sm text-slate-400 mb-1">Features</h3>
            <ul className="list-disc list-inside text-white space-y-1">
              {features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Create in Directory
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
            placeholder="/path/to/projects"
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={browseForPath}
            className="px-4 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
          >
            Browse
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-2">
          Project will be created at: {targetPath ? `${targetPath}/${name}` : '(select a directory)'}
        </p>
      </div>
    </div>
  );

  const renderCreatingStep = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
      <h3 className="text-xl font-medium text-white mb-2">Creating Project...</h3>
      <p className="text-slate-400">
        Setting up {name} with your specifications
      </p>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Projects
      </button>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Sparkles className="text-purple-400" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white">New Project Wizard</h1>
        </div>
        <p className="text-slate-400 mb-8">
          Create a new project with AI-assisted scaffolding
        </p>

        {step !== 'creating' && renderStepIndicator()}

        <div className="min-h-[300px]">
          {step === 'describe' && renderDescribeStep()}
          {step === 'type' && renderTypeStep()}
          {step === 'stack' && renderStackStep()}
          {step === 'features' && renderFeaturesStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'creating' && renderCreatingStep()}
        </div>

        {step !== 'creating' && (
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
            <button
              onClick={step === 'describe' ? () => navigate('/projects') : prevStep}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              {step === 'describe' ? 'Cancel' : 'Back'}
            </button>

            {step === 'review' ? (
              <button
                onClick={createProject}
                disabled={!canProceed() || isCreating}
                className="flex items-center gap-2 px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                <Sparkles size={18} />
                Create Project
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                Continue
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
