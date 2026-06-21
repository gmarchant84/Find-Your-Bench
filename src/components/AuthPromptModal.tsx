import { X, MapPin, Camera, Star, Award } from 'lucide-react';

interface AuthPromptModalProps {
  onSignUp: () => void;
  onLogIn: () => void;
  onClose: () => void;
  /** Optional override for the headline action text */
  action?: string;
}

const PERKS = [
  { icon: MapPin, label: 'Add benches to the map' },
  { icon: Camera, label: 'Upload photos' },
  { icon: Star, label: 'Write reviews' },
  { icon: Award, label: 'Earn badges & track progress' },
];

export default function AuthPromptModal({ onSignUp, onLogIn, onClose, action }: AuthPromptModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-green-50 to-emerald-100 border-b border-green-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-white/60 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <img
              src="/fyb-logo.png"
              alt="Find Your Bench"
              className="w-10 h-10 rounded-xl object-contain"
            />
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {action ?? 'Join the community'}
              </h2>
              <p className="text-xs text-green-700 font-medium">It's free, always.</p>
            </div>
          </div>
        </div>

        {/* Perks list */}
        <div className="px-6 py-4 space-y-2.5">
          <p className="text-sm text-gray-500 mb-1">Create a free account to:</p>
          {PERKS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">{label}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-7 space-y-2.5">
          <button
            onClick={onSignUp}
            className="w-full py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl font-bold text-sm transition shadow-sm shadow-green-200 btn-press"
          >
            Create Free Account
          </button>
          <button
            onClick={onLogIn}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 rounded-xl font-semibold text-sm transition btn-press"
          >
            Log In
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm transition"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
}
