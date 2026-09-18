/**
 * In-app Terms and Privacy copy.
 *
 * ⚠️ DRAFT — NOT LEGAL ADVICE. This is a structurally complete, honest starting point written
 * against what the app actually does today (Firebase auth, Firestore, Cloud Storage video,
 * Razorpay payments, no ads, no third-party analytics). It must be reviewed by a lawyer before
 * submission, and the placeholders below must be filled in:
 *   - LEGAL_ENTITY: the registered company name that owns Rava
 *   - GOVERNING_LAW / jurisdiction
 *   - GRIEVANCE_OFFICER: India's IT Rules 2021 require a named grievance officer with contact
 *     details for a platform hosting user content.
 *
 * Both stores also require a publicly reachable privacy-policy URL — an in-app screen alone
 * is not sufficient. Host the same text at https://rava.one/privacy and link it in the
 * App Store Connect and Play Console listings.
 */

export const LEGAL_ENTITY = '[LEGAL ENTITY NAME]';
export const CONTACT_EMAIL = 'shopatrava@gmail.com';
export const GOVERNING_LAW = 'the laws of India, with courts at Hyderabad, Telangana';
/** Effective date shown on both documents. Bump whenever the text materially changes. */
export const LEGAL_LAST_UPDATED = '21 August 2026';

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export const TERMS: LegalDoc = {
  title: 'Terms & Conditions',
  intro: `These terms govern your use of Rava, operated by ${LEGAL_ENTITY}. By creating an account or using the app you agree to them. Last updated ${LEGAL_LAST_UPDATED}.`,
  sections: [
    {
      heading: '1. Who can use Rava',
      body: [
        'You must be at least 13 years old to use Rava, and at least 18 to sell products, receive payouts, or enter a brand collaboration.',
        'You are responsible for keeping your account secure and for everything that happens under it.',
      ],
    },
    {
      heading: '2. Your content',
      body: [
        'You keep ownership of the reels, images, and text you upload. By posting, you grant Rava a worldwide, non-exclusive, royalty-free licence to host, display, reformat, and distribute that content inside the app and in Rava promotional material, for as long as you keep it posted.',
        'You confirm that you own or have permission to use everything in your reels, including the music, footage, and any brand or person shown. Do not upload content taken from other platforms or creators without their permission.',
        'Deleting a reel removes it from the app. Copies may persist briefly in backups.',
      ],
    },
    {
      heading: '3. What is not allowed',
      body: [
        'Nudity or sexual content; content that is violent, hateful, or harassing; content that promotes self-harm; spam, scams, or misleading claims; impersonation; and anything that infringes someone else’s intellectual property.',
        'Do not misrepresent a product, its price, or its availability. Do not use Rava to sell anything illegal or age-restricted.',
        'We may remove content and suspend or terminate accounts that break these rules, and we may do so without prior notice where the content is seriously harmful.',
      ],
    },
    {
      heading: '4. Reporting and moderation',
      body: [
        'Every reel and every account can be reported from inside the app. We review reports and aim to act within 24 hours.',
        'You can also block any account, which removes their content from your feed and prevents them from following you.',
        'If your content or account is actioned and you believe it was a mistake, write to us and we will re-review.',
      ],
    },
    {
      heading: '5. Purchases',
      body: [
        'Products shown in reels are sold by the brand or seller named on the listing, not by Rava. Your purchase contract is with that seller.',
        'Payments are processed by our payment provider. Rava does not store your full card details.',
        'Refunds, exchanges, shipping, and product quality are the seller’s responsibility under their own policy. Contact us if a seller is unresponsive and we will help escalate.',
      ],
    },
    {
      heading: '6. Creator earnings',
      body: [
        'Where a collaboration includes payment, the terms of that specific collaboration apply, including the rate, deliverables, and payout schedule.',
        'You are responsible for your own taxes on anything you earn through Rava.',
      ],
    },
    {
      heading: '7. Ending your use of Rava',
      body: [
        'You can delete your account at any time from Settings on your profile. Deletion removes your profile, reels, likes, saves, comments, and follows.',
        'We may suspend or close an account that repeatedly breaks these terms.',
      ],
    },
    {
      heading: '8. Liability',
      body: [
        'Rava is provided as-is. We do not guarantee uninterrupted service, and we are not liable for the acts of sellers, creators, or other users.',
        'Nothing in these terms limits rights you have under consumer law that cannot be limited by agreement.',
      ],
    },
    {
      heading: '9. Changes and contact',
      body: [
        'We may update these terms. Material changes will be notified in the app before they take effect.',
        `These terms are governed by ${GOVERNING_LAW}.`,
        `Questions: ${CONTACT_EMAIL}`,
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  intro: `This policy explains what Rava collects, why, and what control you have. Operated by ${LEGAL_ENTITY}. Last updated ${LEGAL_LAST_UPDATED}.`,
  sections: [
    {
      heading: 'What we collect',
      body: [
        'Account details: your name, username, email address, and profile photo. If you sign in with Google or Apple, we receive these from them — we never see your password.',
        'Optional profile details you choose to add: phone number, gender, date of birth, country, interests, website, and brand name.',
        'Content you create: reels, captions, product links, comments, likes, saves, and follows.',
        'Usage data: which reels you viewed, your daily streak, and which product links you tapped. This is what powers your feed and a creator’s analytics.',
        'Device permissions you grant: camera and microphone (only while recording a reel), and photo library (only when you pick a video or profile photo). Nothing is captured in the background.',
      ],
    },
    {
      heading: 'What we do not collect',
      body: [
        'We do not collect your contacts, precise location, health data, or browsing activity outside Rava.',
        'We do not sell your personal data, and we do not use it for third-party advertising.',
      ],
    },
    {
      heading: 'Why we use it',
      body: [
        'To run your account and show you a feed worth scrolling.',
        'To match brands with creators, which uses your stated categories, age group, and gender where you have provided them.',
        'To attribute a purchase to the reel that drove it, so creators get paid correctly.',
        'To keep Rava safe: investigating reports, enforcing our terms, and preventing fraud and spam.',
      ],
    },
    {
      heading: 'Who we share it with',
      body: [
        'Google Firebase, which provides our authentication, database, file storage, and hosting.',
        'Our payment provider, when you make a purchase or receive a payout.',
        'Anyone you share a reel link with, and any brand you enter a collaboration with — limited to what the collaboration needs.',
        'Law enforcement, where we are legally required to.',
      ],
    },
    {
      heading: 'Public vs private',
      body: [
        'Your username, profile photo, brand name, reels, and follower counts are visible to everyone.',
        'Your email, phone number, date of birth, and saved reels are not shown to other users.',
      ],
    },
    {
      heading: 'Your controls',
      body: [
        'Edit or remove most profile details at any time from your profile.',
        'Delete your account from Settings. This permanently removes your profile, reels and their video files, likes, saves, view history, comments, and follows. It cannot be undone.',
        'Block any account to stop seeing them and stop them following you.',
        'Request a copy of your data, or ask us to correct or delete something specific, by writing to us.',
      ],
    },
    {
      heading: 'Retention',
      body: [
        'We keep your data while your account is open. After deletion it is removed from our live systems immediately and from backups within 30 days.',
        'We may retain a minimal record of enforcement actions to stop a banned user simply signing up again.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'Rava is not for children under 13. If we learn that an account belongs to a child under 13 we will delete it.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        `For any privacy question, or to exercise any of the rights above: ${CONTACT_EMAIL}`,
        'Grievance Officer: [NAME], [EMAIL] — as required under India’s Information Technology Rules, 2021.',
      ],
    },
  ],
};
