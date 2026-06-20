import { useState } from 'react';
import { X } from 'lucide-react';

interface LegalPageProps {
  initialTab?: 'tos' | 'privacy';
  onClose?: () => void;
}

export default function LegalPage({ initialTab = 'tos', onClose }: LegalPageProps) {
  const [tab, setTab] = useState<'tos' | 'privacy'>(initialTab);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTab('tos')}
              className={`text-sm font-semibold pb-0.5 transition border-b-2 ${
                tab === 'tos' ? 'text-green-700 border-green-600' : 'text-gray-400 border-transparent hover:text-gray-700'
              }`}
            >
              Terms of Service
            </button>
            <button
              onClick={() => setTab('privacy')}
              className={`text-sm font-semibold pb-0.5 transition border-b-2 ${
                tab === 'privacy' ? 'text-green-700 border-green-600' : 'text-gray-400 border-transparent hover:text-gray-700'
              }`}
            >
              Privacy Policy
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 flex-1 w-full">
        {tab === 'tos' ? <TermsOfService /> : <PrivacyPolicy />}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function TermsOfService() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Terms of Service</h1>
      <p className="text-xs text-gray-400 mb-8">Last updated: May 31, 2026</p>

      <Section title="1. About Find Your Bench">
        <p>
          Find Your Bench ("we," "us," "our") is a community platform at findyourbench.app that lets
          people discover, add, and rate outdoor benches. These Terms govern your use of the app and
          any content you submit.
        </p>
        <p>
          By creating an account or using the app, you agree to these Terms. If you don't agree,
          please don't use the app.
        </p>
      </Section>

      <Section title="2. Your Account">
        <p>
          You must provide a valid email address and choose a username. You're responsible for keeping
          your account credentials secure. You may not impersonate another person or create accounts
          for misleading purposes.
        </p>
        <p>
          We reserve the right to suspend or delete accounts that violate these Terms at any time,
          without notice.
        </p>
      </Section>

      <Section title="3. User-Generated Content">
        <p>
          You may submit bench locations, photos, names, descriptions, ratings, and other content
          ("Content"). You retain ownership of content you create, but by submitting it you grant us
          a worldwide, royalty-free, non-exclusive license to store, display, and distribute it within
          the app.
        </p>
        <p>
          You are solely responsible for the content you submit. Do not upload content that is illegal,
          offensive, private (e.g., photos of people without their consent), or misleading. We may
          remove any content at our discretion.
        </p>
        <p>
          By uploading a photo, you confirm you either took it or have the right to share it, and that
          it does not violate anyone's privacy.
        </p>
      </Section>

      <Section title="4. Bench Locations & Safety">
        <p>
          Bench locations are user-submitted and may be inaccurate, outdated, or removed from the
          real world. Always exercise your own judgment when visiting a location. We are not responsible
          for any injury, loss, or damage that results from visiting a bench location found through
          this app.
        </p>
        <p>
          Use common sense. If a location seems unsafe, don't go there.
        </p>
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>Submit false, misleading, or spam content</li>
          <li>Harass, threaten, or abuse other users</li>
          <li>Attempt to access or tamper with other users' accounts or data</li>
          <li>Use automated tools to scrape or abuse the service</li>
          <li>Upload photos containing recognizable faces without consent</li>
        </ul>
      </Section>

      <Section title="6. Disclaimer of Warranties">
        <p>
          Find Your Bench is provided "as is" without any warranties, express or implied. We do not
          guarantee accuracy, availability, or fitness for a particular purpose. The app may be
          unavailable from time to time for maintenance or technical reasons.
        </p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Find Your Bench and its operators are not liable
          for any indirect, incidental, special, or consequential damages arising from your use of the
          app, including but not limited to personal injury, property damage, or data loss.
        </p>
      </Section>

      <Section title="8. Changes to These Terms">
        <p>
          We may update these Terms at any time. Continued use of the app after changes are posted
          constitutes your acceptance of the updated Terms.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Questions about these Terms? Reach us at the email associated with findyourbench.app. We're
          a small project and will do our best to respond.
        </p>
      </Section>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
      <p className="text-xs text-gray-400 mb-8">Last updated: May 31, 2026</p>

      <Section title="1. What We Collect">
        <p>When you use Find Your Bench, we collect:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Account data:</strong> your email address and username when you register</li>
          <li><strong>Location data:</strong> GPS coordinates you submit when adding a bench, and optionally your current location to show nearby benches</li>
          <li><strong>Photos:</strong> images you upload of benches</li>
          <li><strong>Content:</strong> bench names, descriptions, ratings, and tags you create</li>
          <li><strong>Usage data:</strong> basic app activity (benches added, badges earned) stored in your profile</li>
        </ul>
        <p>We do not collect payment information, and we do not use advertising trackers.</p>
      </Section>

      <Section title="2. How We Use Your Data">
        <p>We use your data to:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>Power core app features (displaying benches, your profile, leaderboards)</li>
          <li>Show your contributions attributed to your username</li>
          <li>Improve app features and fix bugs</li>
          <li>Send important service-related communications if needed</li>
        </ul>
        <p>We do not sell your data. We do not use it for advertising.</p>
      </Section>

      <Section title="3. What's Public">
        <p>
          Bench locations, photos, names, ratings, and your username are visible to all users of the
          app. If you add a bench or write a review, other users will see your username.
        </p>
        <p>
          Your email address is never shown to other users.
        </p>
      </Section>

      <Section title="4. Location Data">
        <p>
          The app may request access to your device's location to help you find benches nearby. This
          access is optional — you can use the app without granting location permission. Location is
          used only within the app and is not shared with third parties.
        </p>
        <p>
          When you add a bench, its GPS coordinates are stored and displayed publicly as part of
          the bench record.
        </p>
      </Section>

      <Section title="5. Photos">
        <p>
          Photos you upload are stored securely and displayed within the app. By uploading a photo
          you confirm you have the right to share it. Do not upload photos that include recognizable
          faces of people without their consent.
        </p>
        <p>
          You can request deletion of your photos by contacting us.
        </p>
      </Section>

      <Section title="6. Data Storage & Security">
        <p>
          Your data is stored using Supabase, a secure cloud database platform. We use
          industry-standard security practices including encrypted connections and row-level access
          controls. No system is perfectly secure, but we take reasonable measures to protect your data.
        </p>
      </Section>

      <Section title="7. Data Retention & Deletion">
        <p>
          We retain your account data and contributions as long as your account exists. If you'd like
          your account and data deleted, contact us and we will remove it within 30 days.
        </p>
      </Section>

      <Section title="8. Third-Party Services">
        <p>The app uses the following third-party services:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Google Maps:</strong> to display the map and search for places (subject to Google's Privacy Policy)</li>
          <li><strong>Supabase:</strong> for database and authentication (subject to Supabase's Privacy Policy)</li>
        </ul>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          Find Your Bench is not directed at children under 13. We do not knowingly collect data from
          children under 13. If you believe a child has provided us personal data, contact us and we
          will delete it.
        </p>
      </Section>

      <Section title="10. Your Rights">
        <p>
          You may request access to, correction of, or deletion of your personal data at any time by
          contacting us. We will respond within 30 days.
        </p>
      </Section>

      <Section title="11. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the updated policy in the
          app. Continued use of the app after changes constitutes acceptance.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Privacy questions or data requests? Reach us at the email associated with findyourbench.app.
        </p>
      </Section>
    </div>
  );
}
