import type { Metadata } from 'next';
import Link from 'next/link';
import { LANDING_ORIGIN } from '../../lib/config';
import { MEDIA } from '../../lib/media';
import { SITE_NAME } from '../../lib/seo';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description:
    'Read the Terms and Conditions for using Rava. Understand community guidelines, creator agreements, brand collaborations, and shopping policies.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: `Terms and Conditions | ${SITE_NAME}`,
    description:
      'Understand your rights and responsibilities when using Rava for shopping, creator content, and brand partnerships.',
    url: `${LANDING_ORIGIN}/terms`,
    type: 'article',
  },
};

export default function TermsPage() {
  const lastUpdated = '21 August 2026';
  const contactEmail = 'shopatrava@gmail.com';
  const governingLaw = 'the laws of India, with jurisdiction in Hyderabad, Telangana';

  const sections = [
    {
      title: '1. Eligibility & Acceptance',
      subsections: [
        {
          subtitle: 'Age Requirements',
          content:
            'You must be at least 13 years old to use Rava for browsing and shopping. You must be at least 18 years old (or the age of legal majority in your jurisdiction) to sell products, receive creator payouts, or execute brand collaboration agreements.',
        },
        {
          subtitle: 'Agreement to Terms',
          content:
            'By downloading, accessing, or using Rava on iOS, Android, or Web, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not use our services.',
        },
      ],
    },
    {
      title: '2. User Content & Licensing',
      subsections: [
        {
          subtitle: 'Ownership of Content',
          content:
            'You retain full intellectual property ownership of the videos, audio, images, captions, and text you create and post on Rava.',
        },
        {
          subtitle: 'License Grant to Rava',
          content:
            'By posting reels and media on Rava, you grant Rava a worldwide, non-exclusive, royalty-free license to host, cache, distribute, publicly display, reformat, and feature such content within the app and in promotional contexts related to the platform.',
        },
        {
          subtitle: 'Content Representations & Warranties',
          content:
            'You confirm that you own or possess all necessary rights, licenses, consents, and permissions for all elements of your uploaded reels (including music, visual footage, trademarks, and tagged products). Do not upload unauthorized third-party content without permission.',
        },
      ],
    },
    {
      title: '3. Prohibited Conduct & Community Standards',
      subsections: [
        {
          subtitle: 'Unlawful & Harmful Content',
          content:
            'The following are strictly prohibited: sexually explicit or pornographic media; harassment, bullying, hate speech, or defamation; violent or dangerous content; fraudulent scams or deceptive commercial claims; and intellectual property infringement.',
        },
        {
          subtitle: 'Commercial & Product Integrity',
          content:
            'You may not misrepresent product pricing, stock availability, authenticity, or product claims. Tagging misleading affiliate destinations or selling illegal, counterfeit, or restricted goods will result in immediate suspension.',
        },
        {
          subtitle: 'Platform Security',
          content:
            'You must not attempt to reverse engineer, scrape, introduce malicious code, circumvent security controls, or artificially manipulate views, likes, or attribution metrics.',
        },
      ],
    },
    {
      title: '4. Moderation, Reporting & Enforcement',
      subsections: [
        {
          subtitle: 'In-App Reporting',
          content:
            'Users may report any reel, comment, or user profile directly within the app. Our safety team reviews reports promptly with a goal of resolution within 24 hours.',
        },
        {
          subtitle: 'Account Suspension & Removal',
          content:
            'We reserve the right to remove content, restrict visibility, or suspend/terminate accounts that violate these terms, with or without prior notice where violations pose risk to our community or legal compliance.',
        },
      ],
    },
    {
      title: '5. Purchases & Seller Marketplace Terms',
      subsections: [
        {
          subtitle: 'Direct Contract with Sellers',
          content:
            'Products featured in reels are sold by independent brands or merchant sellers. When you initiate a purchase, your transaction contract is directly with that seller.',
        },
        {
          subtitle: 'Shipping, Returns & Customer Support',
          content:
            'Fulfillment, delivery times, exchanges, and return policies are governed by the respective merchant seller’s terms. If a seller is non-responsive, Rava support will assist in facilitating escalation.',
        },
        {
          subtitle: 'Payment Security',
          content:
            'All payment transactions are encrypted and processed through certified third-party payment providers. Rava does not store sensitive card security codes.',
        },
      ],
    },
    {
      title: '6. Creator Collaborations & Earnings',
      subsections: [
        {
          subtitle: 'Campaign Agreements',
          content:
            'Brand-creator collaborations are governed by the specific terms, milestones, deliverables, and compensation agreed upon within the platform campaign brief.',
        },
        {
          subtitle: 'Taxes & Compliance',
          content:
            'Creators are solely responsible for determining, reporting, and remitting any applicable income or value-added taxes on earnings received through Rava collaborations.',
        },
      ],
    },
    {
      title: '7. Termination & Account Deletion',
      subsections: [
        {
          subtitle: 'Voluntary Account Closure',
          content:
            'You can delete your account at any time directly through the app settings. Account deletion is permanent and removes all associated profile data, reels, comments, likes, and follows.',
        },
      ],
    },
    {
      title: '8. Disclaimers & Limitation of Liability',
      subsections: [
        {
          subtitle: 'Service "As-Is"',
          content:
            'Rava is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied, including uninterrupted availability or fitness for a particular purpose.',
        },
        {
          subtitle: 'Limitation of Liability',
          content:
            'To the maximum extent permitted by law, Rava and its affiliates shall not be liable for indirect, incidental, special, consequential, or punitive damages resulting from your use of the service or third-party merchant actions.',
        },
      ],
    },
    {
      title: '9. Governing Law & Dispute Resolution',
      subsections: [
        {
          subtitle: 'Jurisdiction',
          content: `These terms and any disputes arising out of or related to Rava shall be governed by and construed in accordance with ${governingLaw}.`,
        },
        {
          subtitle: 'Contact & Legal Notices',
          content: `Legal notices and formal communications must be sent to ${contactEmail}.`,
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
            <Link href="/privacy" className="legal-nav-switch">
              Privacy Policy →
            </Link>
          </div>
        </div>
      </header>

      <main className="legal-main">
        <div className="legal-container">
          <div className="legal-header-card">
            <span className="legal-badge">Legal Documentation</span>
            <h1 className="legal-title">Terms &amp; Conditions</h1>
            <p className="legal-subtitle">
              The rules, rights, and responsibilities governing your use of Rava, creator collaborations, and shopping.
            </p>
            <div className="legal-meta-row">
              <span>Effective Date: <strong>{lastUpdated}</strong></span>
              <span>•</span>
              <span>Inquiries: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></span>
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
            <h3>Questions about these terms?</h3>
            <p>Our support team is here to assist with any questions regarding collaborations or platform rules.</p>
            <div className="legal-cta-buttons">
              <a href={`mailto:${contactEmail}`} className="btn-solid" style={{ textDecoration: 'none' }}>
                Contact Legal Support
              </a>
              <Link href="/privacy" className="btn-ghost" style={{ textDecoration: 'none' }}>
                View Privacy Policy
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
