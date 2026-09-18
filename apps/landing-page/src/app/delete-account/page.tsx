import type { Metadata } from 'next';
import Link from 'next/link';
import { LANDING_ORIGIN } from '../../lib/config';
import { MEDIA } from '../../lib/media';
import { SITE_NAME } from '../../lib/seo';

export const metadata: Metadata = {
  title: 'Delete Account & Data Deletion Policy',
  description:
    'Learn how to permanently delete your Rava account and associated personal data. Step-by-step instructions for in-app self-service and email deletion requests.',
  alternates: {
    canonical: '/delete-account',
  },
  openGraph: {
    title: `Delete Account & Data Deletion | ${SITE_NAME}`,
    description:
      'Step-by-step instructions for deleting your Rava account and understanding what data is permanently erased.',
    url: `${LANDING_ORIGIN}/delete-account`,
    type: 'article',
  },
};

export default function DeleteAccountPage() {
  const lastUpdated = '21 August 2026';
  const contactEmail = 'shopatrava@gmail.com';

  const deletedDataTypes = [
    {
      category: 'Account Credentials & Authentication',
      details:
        'Registered email address, unique user ID (UID), secure authentication tokens, and third-party identity provider links (Google Sign-In, Sign in with Apple).',
    },
    {
      category: 'Profile Information',
      details:
        'Full name, unique username, bio, profile avatar photo and source files, brand name, website links, style preferences, and creator category selections.',
    },
    {
      category: 'Uploaded Content & Media',
      details:
        'All published video reels, video source files, thumbnail images, captions, tagged product metadata, and media stored in cloud storage.',
    },
    {
      category: 'Social Interactions & Engagement',
      details:
        'Likes, saved reels/bookmarks, comments and replies, follower connections, following lists, and user block records.',
    },
    {
      category: 'Platform History & Activity',
      details:
        'Streak history, daily login tracking, search query logs, and video view interaction history.',
    },
  ];

  return (
    <div className="legal-layout">
      <header className="legal-nav-header">
        <div className="legal-nav-inner">
          <Link href="/" className="legal-nav-brand">
            <img src={MEDIA.logo} alt="Rava logo" width={32} height={32} className="legal-nav-logo" />
            <span>Rava</span>
          </Link>
          <div className="legal-nav-actions">
            <Link href="/" className="legal-nav-back">
              ← Back to Home
            </Link>
            <Link href="/privacy" className="legal-nav-switch">
              Privacy Policy →
            </Link>
            <Link href="/terms" className="legal-nav-switch">
              Terms →
            </Link>
          </div>
        </div>
      </header>

      <main className="legal-main">
        <div className="legal-container">
          <div className="legal-header-card">
            <span className="legal-badge">Account &amp; Data Management</span>
            <h1 className="legal-title">Delete Account &amp; Data Deletion</h1>
            <p className="legal-subtitle">
              We respect your right to control your personal information. You can permanently delete your Rava account
              and all associated data at any time through our automated in-app settings or via email request.
            </p>
            <div className="legal-meta-row">
              <span>Effective Date: <strong>{lastUpdated}</strong></span>
              <span>•</span>
              <span>Direct Inquiries: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></span>
            </div>
          </div>

          <div className="legal-content">
            {/* Section 1: Step by Step Deletion Methods */}
            <section className="legal-section">
              <h2 className="legal-section-title">How to Delete Your Rava Account</h2>
              <div className="legal-subsections">
                <div className="legal-subsection">
                  <h3 className="legal-subsection-title">Method 1: In-App Self-Serve Deletion (Recommended — Instant)</h3>
                  <p className="legal-paragraph" style={{ marginBottom: '12px' }}>
                    You can instantly and permanently delete your account directly inside the Rava mobile application (iOS or Android) or Web App:
                  </p>
                  <ol style={{ paddingLeft: '20px', margin: '0 0 12px', color: '#4a283e', lineHeight: 1.7, fontSize: '0.95rem' }}>
                    <li>Open the <strong>Rava</strong> app and log in if prompted.</li>
                    <li>Tap the <strong>Profile</strong> tab in the bottom navigation bar.</li>
                    <li>Tap the <strong>Settings</strong> icon (gear icon) in the top-right corner of your profile.</li>
                    <li>Scroll down to the bottom of the Settings menu and tap <strong>&ldquo;Delete account&rdquo;</strong>.</li>
                    <li>Read the confirmation warning and tap <strong>&ldquo;Delete&rdquo;</strong> to finalize.</li>
                  </ol>
                  <p className="legal-paragraph">
                    Your account, profile information, and uploaded media will be immediately deleted from our production systems, and your session will be terminated.
                  </p>
                </div>

                <div className="legal-subsection" style={{ paddingTop: '16px', borderTop: '1px solid #fdf2f8' }}>
                  <h3 className="legal-subsection-title">Method 2: Web / Email Deletion Request (If App is Uninstalled)</h3>
                  <p className="legal-paragraph" style={{ marginBottom: '12px' }}>
                    If you have uninstalled the app or cannot access your account, you can submit a manual deletion request by email:
                  </p>
                  <ol style={{ paddingLeft: '20px', margin: '0 0 12px', color: '#4a283e', lineHeight: 1.7, fontSize: '0.95rem' }}>
                    <li>
                      Compose an email from the <strong>registered email address</strong> associated with your Rava account.
                    </li>
                    <li>
                      Send the email to: <a href={`mailto:${contactEmail}`} style={{ color: 'var(--blue-dark)', fontWeight: 600 }}>{contactEmail}</a>
                    </li>
                    <li>
                      Set the subject line to: <strong>&ldquo;Delete My Rava Account&rdquo;</strong>
                    </li>
                    <li>
                      Include your <strong>username</strong> or <strong>registered email</strong> in the message body along with a clear statement requesting account deletion.
                    </li>
                  </ol>
                  <p className="legal-paragraph">
                    Our security team will verify ownership and process the deletion within <strong>48 to 72 business hours</strong>, sending you a final confirmation once completed.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Data Deleted */}
            <section className="legal-section">
              <h2 className="legal-section-title">What Data Is Permanently Deleted</h2>
              <p className="legal-paragraph" style={{ marginBottom: '16px' }}>
                When your account is deleted, the following categories of data are permanently and irreversibly purged:
              </p>
              <div className="legal-subsections">
                {deletedDataTypes.map((item, idx) => (
                  <div key={idx} className="legal-subsection">
                    <h3 className="legal-subsection-title">✦ {item.category}</h3>
                    <p className="legal-paragraph">{item.details}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3: Retention & Backup Policy */}
            <section className="legal-section">
              <h2 className="legal-section-title">Data Retention &amp; Backup Policy</h2>
              <div className="legal-subsections">
                <div className="legal-subsection">
                  <h3 className="legal-subsection-title">Immediate Production Deletion</h3>
                  <p className="legal-paragraph">
                    Upon confirmation of deletion, your account credentials, profile document, uploaded videos, and social graph references are immediately and permanently removed from our live production databases (Google Firebase Firestore, Cloud Storage, and Authentication).
                  </p>
                </div>

                <div className="legal-subsection">
                  <h3 className="legal-subsection-title">Backup Purge Period (Maximum 30 Days)</h3>
                  <p className="legal-paragraph">
                    Residual copies residing in routine, encrypted rolling system backups will be completely overwritten and purged within a maximum of <strong>30 days</strong> from the deletion date. During this interim period, backup data is kept inaccessible, encrypted, and isolated from production use.
                  </p>
                </div>

                <div className="legal-subsection">
                  <h3 className="legal-subsection-title">Legal &amp; Financial Record Keeping Exceptions</h3>
                  <p className="legal-paragraph">
                    If you participated in commercial transactions (such as completed brand collaboration payouts or product orders with third-party sellers), anonymized financial records, invoices, or tax compliance logs may be retained strictly as required by statutory financial, accounting, or anti-fraud laws. No personal browsing, interaction, or profile data is retained.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Irreversibility */}
            <section className="legal-section">
              <h2 className="legal-section-title">Important Notice Regarding Account Deletion</h2>
              <div className="legal-subsections">
                <div className="legal-subsection">
                  <p className="legal-paragraph">
                    <strong>Account deletion is irreversible.</strong> Once your account is deleted, you cannot recover your username, published reels, followers, bookmarks, or streak history. If you wish to use Rava again in the future, you will need to register a new account.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="legal-footer-cta">
            <h3>Need assistance with account deletion?</h3>
            <p>If you encounter any issues or have questions regarding your personal data, our privacy and support team is ready to help.</p>
            <div className="legal-cta-buttons">
              <a href={`mailto:${contactEmail}?subject=Delete%20My%20Rava%20Account`} className="btn-solid" style={{ textDecoration: 'none' }}>
                Email Deletion Request
              </a>
              <Link href="/privacy" className="btn-ghost" style={{ textDecoration: 'none' }}>
                Read Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="legal-footer">
        <div className="legal-footer-inner">
          <p>© {new Date().getFullYear()} Rava. All rights reserved.</p>
          <div className="legal-footer-links">
            <Link href="/">Home</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms &amp; Conditions</Link>
            <Link href="/delete-account">Delete Account</Link>
            <a href={`mailto:${contactEmail}`}>Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
