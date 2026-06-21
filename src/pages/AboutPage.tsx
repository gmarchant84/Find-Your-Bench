import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Camera, Award, Globe, Users, Compass } from 'lucide-react';

export default function AboutPage() {
  const navigate = useNavigate();

  const cities = [
    { name: 'San Francisco', benches: '80+' },
    { name: 'Los Angeles', benches: '20+' },
    { name: 'San Diego', benches: '15+' },
    { name: 'Denver', benches: '15+' },
    { name: 'Palo Alto', benches: '10+' },
    { name: 'Juneau, AK', benches: '10+' },
  ];

  const features = [
    { icon: MapPin, title: 'Discover Benches', desc: 'Browse a map of unique benches near you — from hidden park gems to iconic city spots.' },
    { icon: Star, title: 'Rate & Review', desc: 'Rate benches on comfort, views, and vibes. Help others find the perfect sit.' },
    { icon: Camera, title: 'Add Photos', desc: 'Upload photos to show off your favorite benches and help others know what to expect.' },
    { icon: Award, title: 'Earn Badges', desc: 'Explore and contribute to earn Founding Bencher status and other community badges.' },
    { icon: Globe, title: 'Share Benches', desc: 'Share a bench with friends via a direct link — great for meetup spots or hidden gems.' },
    { icon: Users, title: 'Community Verified', desc: 'Benches are verified by the community — confirming they exist and are worth visiting.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50">
      <div className="max-w-2xl mx-auto px-4 pb-16">

        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 flex items-center gap-3 px-0 py-3 -mx-4 px-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-green-700 hover:text-green-800 transition min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold text-sm">Back</span>
          </button>
          <h1 className="text-gray-900 font-bold text-sm flex-1 text-center pr-12">About Find Your Bench</h1>
        </div>

        {/* Hero */}
        <div className="text-center mb-10">
          <img src="/fyb-logo.png" alt="Find Your Bench" className="w-20 h-20 rounded-2xl mx-auto mb-4 object-contain shadow-sm" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Find Your Bench</h2>
          <p className="text-green-700 font-semibold tracking-widest uppercase text-xs mb-4">Get Outside. Stay Outside.</p>
          <p className="text-gray-600 text-base leading-relaxed max-w-md mx-auto">
            A community-driven map for discovering, sharing, and cataloging unique public benches around the world.
          </p>
        </div>

        {/* What is FYB */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-gray-900">What is Find Your Bench?</h3>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            Think of it as a blend of Pokémon GO's exploration and Google Maps' place discovery — but focused entirely on benches and the moments around them.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            Every bench has a story. A memorial bench for someone's grandmother. A hidden clifftop seat with a view no one talks about. A park bench where regulars gather every morning. FYB is building the world's largest database of these places — one sit at a time.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Coverage */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-1">Where does FYB work?</h3>
          <p className="text-gray-500 text-sm mb-4">
            FYB works anywhere in the world — you can add a bench from your backyard to Bali. We're currently growing fastest in these cities:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cities.map(({ name, benches }) => (
              <div key={name} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                <span className="text-sm font-medium text-gray-800">{name}</span>
                <span className="text-xs font-bold text-green-700">{benches}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Don't see your city? Add the first bench and start the movement.</p>
        </div>

        {/* Free forever */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-center text-white mb-6">
          <h3 className="font-bold text-lg mb-2">Free, always.</h3>
          <p className="text-green-100 text-sm leading-relaxed mb-4">
            Find Your Bench is free to use and always will be. No ads, no paywalls, no subscriptions. Just benches.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-white text-green-700 rounded-xl font-bold text-sm hover:bg-green-50 transition"
          >
            Start Exploring
          </button>
        </div>

        {/* Built by */}
        <div className="text-center text-gray-400 text-xs">
          <p>Built with ❤️ in San Jose, CA</p>
          <p className="mt-1">© 2026 Find Your Bench</p>
        </div>

      </div>
    </div>
  );
}
