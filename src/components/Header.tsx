import { Plus, Trophy, Filter, Search, Navigation, Map, List, User, LogIn, Info } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { BENCH_VIBES } from '../lib/supabase';

interface HeaderProps {
  viewMode: 'map' | 'list';
  showLeaderboard: boolean;
  showFilters: boolean;
  showProfile: boolean;
  userLocation: { lat: number; lng: number } | null;
  selectedCategory: string;
  isLoggedIn: boolean;
  onViewModeChange: (mode: 'map' | 'list') => void;
  onShowLeaderboard: () => void;
  onShowFilters: () => void;
  onShowProfile: () => void;
  onShowPlaceSearch: () => void;
  onShowNearby: () => void;
  onAddBench: () => void;
  onCategoryChange: (category: string) => void;
  onGoHome: () => void;
}

export default function Header({
  viewMode,
  showLeaderboard,
  showFilters,
  showProfile,
  userLocation,
  selectedCategory,
  isLoggedIn,
  onViewModeChange,
  onShowLeaderboard,
  onShowFilters,
  onShowProfile,
  onShowPlaceSearch,
  onShowNearby,
  onAddBench,
  onCategoryChange,
  onLocationTypeChange,
  onGoHome,
  onShowAbout,
}: HeaderProps) {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-3">
        {/* Logo + wordmark */}
        <button
          onClick={onGoHome}
          className="flex items-center gap-3 hover:opacity-80 active:opacity-60 transition-opacity min-w-0"
        >
          <img
            src="/fyb-logo.png"
            alt="Find Your Bench"
            className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl object-contain flex-shrink-0"
            style={{ width: 'clamp(3.125rem, 6vw, 4.0625rem)', height: 'clamp(3.125rem, 6vw, 4.0625rem)' }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[17px] sm:text-[19px] font-bold text-gray-900 leading-tight tracking-tight whitespace-nowrap">
              Find Your Bench
            </span>
            <span className="text-[10px] sm:text-[11px] text-gray-400 font-medium tracking-widest uppercase leading-tight mt-0.5">
              Get Outside. Stay Outside.
            </span>
          </div>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onAddBench}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg transition font-semibold text-sm shadow-sm btn-press"
            aria-label="Add Bench"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Add</span>
          </button>
          {isLoggedIn ? (
            <div className="flex items-center gap-1.5">
              <NotificationBell />
              <button
                onClick={onShowProfile}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition border btn-press ${
                  showProfile
                    ? 'bg-gray-900 border-gray-900 text-white'
                    : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
                }`}
                aria-label="Profile"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onShowProfile}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-lg transition font-semibold text-sm border border-gray-200 btn-press"
              aria-label="Log in"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden xs:inline">Log in</span>
            </button>
          )}
        </div>
      </div>

      {/* Nav tabs */}
      <div className="max-w-7xl mx-auto border-b border-gray-100">
        <div className="px-3 sm:px-4 flex items-center gap-0">
          {[
            { id: 'map' as const, label: 'Map', icon: Map, active: viewMode === 'map', onClick: () => onViewModeChange('map') },
            { id: 'list' as const, label: 'List', icon: List, active: viewMode === 'list', onClick: () => onViewModeChange('list') },
            { id: 'leaderboard' as const, label: 'Leaders', icon: Trophy, active: showLeaderboard, onClick: onShowLeaderboard },
            { id: 'about' as const, label: 'About', icon: Info, active: false, onClick: () => onShowAbout?.() },
          ].map(({ id, label, icon: Icon, active, onClick }) => (
            <button
              key={id}
              onClick={onClick}
              className={`relative flex items-center gap-1.5 px-3 sm:px-5 py-2.5 text-sm font-medium transition ${
                active ? 'text-green-700' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-1.5">
        {userLocation && (
          <button
            onClick={onShowNearby}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200 transition shadow-sm btn-press"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-500" />
            <span>Nearby</span>
          </button>
        )}
        <button
          onClick={onShowPlaceSearch}
          className="flex-1 sm:flex-none flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-500 rounded-lg text-sm border border-gray-200 transition btn-press"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-gray-400">Search places or benches…</span>
        </button>
        <button
          onClick={onShowFilters}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition btn-press ${
            showFilters
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter className={`w-3.5 h-3.5 ${showFilters ? 'text-white' : 'text-gray-500'}`} />
          <span>Filter</span>
          {selectedCategory !== 'all' && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />
          )}
        </button>
      </div>

      {/* Filter drawer */}
      {showFilters && (
        <div className="border-t border-gray-100 bg-white animate-fade-in">
          {/* Vibe row */}
          <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 pb-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Vibe</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => onCategoryChange('all')}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs transition border btn-press ${
                  selectedCategory === 'all'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                <span>🪑</span>
                <span>All</span>
              </button>
              {BENCH_VIBES.map((v) => {
                const isActive = selectedCategory === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onCategoryChange(v.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs transition border btn-press ${
                      isActive
                        ? `${v.bg} ${v.color} ${v.border} shadow-sm`
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span>{v.emoji}</span>
                    <span className="whitespace-nowrap">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Location type row */}
          <div className="max-w-7xl mx-auto px-3 sm:px-4 pb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Location</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
              <button
                onClick={() => onLocationTypeChange('all')}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs transition border btn-press ${
                  selectedLocationType === 'all'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                <span>📍</span>
                <span>Any</span>
              </button>
              {LOCATION_TYPES.filter(l => l.id !== 'other').map((lt) => {
                const isActive = selectedLocationType === lt.id;
                return (
                  <button
                    key={lt.id}
                    onClick={() => onLocationTypeChange(lt.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs transition border btn-press ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <span>{lt.emoji}</span>
                    <span className="whitespace-nowrap">{lt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {(selectedCategory !== 'all' || selectedLocationType !== 'all') && (
            <div className="max-w-7xl mx-auto px-3 sm:px-4 pb-3 flex justify-end">
              <button
                onClick={() => { onCategoryChange('all'); onLocationTypeChange('all'); }}
                className="text-xs text-gray-400 hover:text-gray-700 transition font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
