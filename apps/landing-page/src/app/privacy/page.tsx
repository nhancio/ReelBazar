import type { Metadata } from 'next';
import Link from 'next/link';
import { LANDING_ORIGIN } from '../../lib/config';
import { MEDIA } from '../../lib/media';
import { SITE_NAME } from '../../lib/seo';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Read Rava’s Privacy Policy. Learn how we collect, use, protect, and handle your data across our fashion social commerce platform and mobile applications.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: `Privacy Policy | ${SITE_NAME}`,
    description:
      'Learn how Rava protects your personal data, handles video and account permissions, and ensures privacy-first shopping.',
    url: `${LANDING_ORIGIN}/privacy`,
    type: 'article',
  },
};

export default function PrivacyPage() {
  const lastUpdated = '21 August 2026';
  const contactEmail = 'shopatrava@gmail.com';

  const sections = [
    {
      title: '1. Information We Collect',
      subsections: [
        {
          subtitle: 'Account Information',
          content:
            'When you register for Rava, we collect your name, username, email address, and profile photo. When signing in via third-party providers (Google Sign-In or Sign in with Apple), authentication is handled securely and we never receive or store your third-party account password.',
        },
        {
          subtitle: 'Profile & Creator Details',
          content:
            'You may optionally provide phone number, gender, date of birth, country, style interests, website links, or brand name to personalize your feed and facilitate brand-creator discovery.',
        },
        {
          subtitle: 'Content & Interaction Data',
          content:
            'We process reels you upload, captions, tagged product URLs, likes, saves, comments, follows, and view interactions to power your personalized feed and calculate creator engagement metrics.',
        },
        {
          subtitle: 'Device Permissions',
          content:
            'We request access to your device camera and microphone strictly while you are actively recording a reel. Photo and media library access is used solely when selecting videos or profile photos. We never record in the background or access unauthorized sensors.',
        },
      ],
    },
    {
      title: '2. Information We Do NOT Collect',
      subsections: [
        {
          subtitle: 'No Invasive Tracking',
          content:
            'We do not collect or track your device contacts, precise GPS background coordinates, biometric health data, or off-app browsing history.',
        },
        {
          subtitle: 'No Data Brokering',
          content:
            'We do not sell, rent, or trade your personal data to data brokers or third-party advertising networks.',
        },
      ],
    },
    {
      title: '3. How We Use Your Information',
      subsections: [
        {
          subtitle: 'Core Platform Operations',
          content:
            'To maintain your account, stream high-performance shoppable video reels, process searches, and synchronize your preferences across devices.',
        },
        {
          subtitle: 'Brand & Creator Matching',
          content:
            'To match fashion brands with relevant creators based on category alignment, audience demographics, and creator style niches.',
        },
        {
          subtitle: 'Attribution & Creator Payouts',
          content:
            'To accurately attribute product purchases to the specific reel and creator that inspired them, ensuring transparent analytics and fair compensation.',
        },
        {
          subtitle: 'Safety & Trust',
          content:
            'To investigate reported content, moderate safety violations, prevent spam and fraud, and protect our community.',
        },
      ],
    },
    {
      title: '4. Third-Party Services & Data Sharing',
      subsections: [
        {
          subtitle: 'Infrastructure & Storage',
          content:
            'We utilize Google Firebase and Google Cloud for secure user authentication, database management, video streaming, and scalable infrastructure.',
        },
        {
          subtitle: 'Payment Processing',
          content:
            'Purchases and payouts are processed via PCI-DSS compliant payment gateways (such as Razorpay). Rava does not store full credit/debit card numbers or sensitive payment credentials on our servers.',
        },
        {
          subtitle: 'Legal Requirements',
          content:
            'We may disclose information if required by applicable law, valid court order, government request, or to protect the vital legal rights and safety of users.',
        },
      ],
    },
    {
      title: '5. Public vs. Private Data Visibility',
      subsections: [
        {
          subtitle: 'Public Information',
          content:
            'Your username, display name, profile avatar, brand affiliation, published reels, public likes, and follower counts are visible to other Rava users.',
        },
        {
          subtitle: 'Private Information',
          content:
            'Your email address, phone number, date of birth, saved bookmark collection, and private transaction records remain strictly confidential and are not visible to the public.',
        },
      ],
    },
    {
      title: '6. User Rights & Data Controls',
      subsections: [
        {
          subtitle: 'Account Management & Export',
          content:
            'You can view, edit, or update your profile information anytime inside the app settings. You may request a copy of your personal data by contacting our team.',
        },
        {
          subtitle: 'Account & Data Deletion',
          content:
            'You have the right to permanently delete your account at any time via Profile → Settings → Delete Account. Deletion permanently erases your profile, uploaded reels, video assets, comments, likes, saves, and follower links from our active databases.',
        },
        {
          subtitle: 'Blocking & Moderation',
          content:
            'You can block any user account to instantly prevent them from interacting with you or seeing your content.',
        },
      ],
    },
    {
      title: '7. Data Retention & Security',
      subsections: [
        {
          subtitle: 'Retention Duration',
          content:
            'We retain personal data only for as long as your account remains active. Upon deletion, data is removed immediately from primary systems and purged from rolling backups within 30 days.',
        },
        {
          subtitle: 'Security Standards',
          content:
            'We employ industry-standard encryption (TLS/SSL in transit and AES at rest), secure cloud authentication tokens, and principle-of-least-privilege access controls.',
        },
      ],
    },
    {
      title: '8. Children’s Privacy',
      subsections: [
        {
          subtitle: 'Age Restriction',
          content:
            'Rava is not intended for individuals under 13 years of age. We do not knowingly collect personal information from children under 13. If we discover an account created by a minor under 13, it will be promptly deleted.',
        },
      ],
    },
    {
      title: '9. Grievance Redressal & Contact',
      subsections: [
        {
          subtitle: 'Contact Information',
          content: `For any questions, concerns, or privacy requests regarding this policy, email us at ${contactEmail}.`,
        },
        {
          subtitle: 'Grievance Officer (India IT Rules 2021)',
          content: `In compliance with India’s Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, grievance inquiries can be directed to our designated grievance team at ${contactEmail} with the subject line "Privacy Grievance".`,
        },
      ],
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
            <Link href="/terms" className="legal-nav-switch">
              Terms &amp; Conditions →
            </Link>
          </div>
        </div>
      </header>

      <main className="legal-main">
        <div className="legal-container">
          <div className="legal-header-card">
            <span className="legal-badge">Legal Documentation</span>
            <h1 className="legal-title">Privacy Policy</h1>
            <p className="legal-subtitle">
              How Rava collects, uses, protects, and handles your information across our mobile apps and web platforms.
            </p>
            <div className="legal-meta-row">
              <span>Effective Date: <strong>{lastUpdated}</strong></span>
              <span>•</span>
              <span>Direct Inquiries: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></span>
            </div>
          </div>

          <div className="legal-content">
            {sections.map((section, idx) => (
              <section key={idx} className="legal-section">
                <h2 className="legal-section-title">{section.title}</h2>
                <div className="legal-subsections">
                  {section.subsections.map((sub, sIdx) => (
                    <div key={sIdx} className="legal-subsection">
                      <h3 className="legal-subsection-title">{sub.subtitle}</h3>
                      <p className="legal-paragraph">{sub.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="legal-footer-cta">
            <h3>Have questions about your privacy?</h3>
            <p>Our team is committed to transparency and data protection. Reach out anytime.</p>
            <div className="legal-cta-buttons">
              <a href={`mailto:${contactEmail}`} className="btn-solid" style={{ textDecoration: 'none' }}>
                Contact Privacy Team
              </a>
              <Link href="/terms" className="btn-ghost" style={{ textDecoration: 'none' }}>
                View Terms of Service
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
