import { Plus, X } from 'lucide-react';

interface FloatingAddButtonProps {
  onClick: () => void;
  active?: boolean;
}

export default function FloatingAddButton({ onClick, active = false }: FloatingAddButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-5 md:bottom-8 md:right-8 h-14 px-5 rounded-full shadow-xl flex items-center gap-2.5 transition-all duration-200 active:scale-95 z-50 group font-bold text-sm tracking-wide ${
        active
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : 'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
      }`}
      aria-label={active ? 'Cancel placement' : 'Add Bench'}
      style={{ boxShadow: active ? '0 4px 20px rgba(239, 68, 68, 0.4)' : '0 4px 20px rgba(16, 185, 129, 0.4)' }}
    >
      {active ? (
        <>
          <X className="w-5 h-5" strokeWidth={2.5} />
          <span>Cancel</span>
        </>
      ) : (
        <>
          <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
          <span>Add Bench</span>
        </>
      )}
    </button>
  );
}
