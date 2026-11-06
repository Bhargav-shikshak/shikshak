import { ArrowLeft } from 'lucide-react';

export type LegalKind = 'terms' | 'privacy';

export function SiteFooter({ variant = 'member' }: { variant?: 'member' | 'admin' | 'auth' }) {
  return <footer className="portal-footer">
    <span className="portal-footer-copy">
      <strong>Shikshak</strong> · {variant === 'admin' ? 'Restricted administration' : 'Neighbourhood learning, made simpler.'}
    </span>
    <nav className="footer-links" aria-label="Footer links">
      <a className="footer-link" href="#terms">Terms &amp; Conditions</a>
      <a className="footer-link" href="#privacy">Privacy Policy</a>
      {variant === 'member' && <a className="footer-admin-link" href="#admin">Admin access</a>}
    </nav>
  </footer>;
}

export function LegalPage({ kind, backHref }: { kind: LegalKind; backHref: string }) {
  const isPrivacy = kind === 'privacy';
  return <>
    <header className="site-header">
      <div className="header-inner legal-header">
        <a className="brand" href={backHref} aria-label="Shikshak home">
          <img src="/shikshak-logo.png" width="40" height="40" alt=""/>
          <span>Shik<span>shak</span><b>.</b></span>
        </a>
        <a className="legal-back" href={backHref}><ArrowLeft size={16}/> Back to Shikshak</a>
      </div>
    </header>
    <main id="main" className="legal-page">
      <div className="legal-intro">
        <p className="eyebrow">SHIKSHAK / LEGAL</p>
        <h1>{isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}</h1>
        <p className="legal-meta">Draft for review · 5 November 2026</p>
        <p className="legal-summary">{isPrivacy
          ? 'What information Shikshak uses to help students and tutors learn together.'
          : 'A clear starting point for using the Shikshak tutoring platform responsibly.'}</p>
      </div>
      <article className="legal-article">
        {isPrivacy ? <>
          <section>
            <h2>Information we handle</h2>
            <p>When you use Shikshak, you may provide your name, email, account role, profile information, teaching or learning preferences, and a selected neighbourhood on the map. Using class features can create booking records, messages, class schedules, notes, homework, uploaded PDFs, and reviews. We may also process technical information needed to operate and protect the service.</p>
          </section>
          <section>
            <h2>How information is used</h2>
            <p>Information is used to operate accounts, show eligible tutor listings, manage class requests and accepted bookings, support classrooms and messages, protect users, and improve reliability. The location marker is intended to describe a neighbourhood, not to publish a precise home address.</p>
          </section>
          <section>
            <h2>Who can see what</h2>
            <p>Students can discover published tutor listings. Teachers cannot browse student profiles or student locations through discovery. When a student sends a class request, the receiving teacher can see the details needed to respond. Classroom conversations and files are intended for the participants in that class; platform administrators may access information where necessary for support, safety, or moderation.</p>
          </section>
          <section>
            <h2>Service providers and security</h2>
            <p>Hosting, authentication, storage, and mapping providers may process information needed to deliver their services. Shikshak uses account access controls and other security measures, but no online service can guarantee absolute security. Avoid uploading sensitive information that is not necessary for your lessons.</p>
          </section>
          <section>
            <h2>Your choices and retention</h2>
            <p>You can edit information made available in your profile and manage the visibility of your tutor listing where those controls are offered. Information may be retained while needed to operate the service, resolve disputes, meet legal obligations, or maintain security. Details of account deletion and formal privacy requests will be published before the public launch.</p>
          </section>
          <section>
            <h2>Young learners and changes</h2>
            <p>Children should use the service with appropriate parent or guardian involvement. This notice may change as Shikshak's features and infrastructure develop; material changes will be reflected in an updated version.</p>
          </section>
        </> : <>
          <section>
            <h2>Using Shikshak</h2>
            <p>Shikshak helps learners discover tutors, request classes, communicate after a booking is accepted, and exchange learning materials. It is a platform for introductions and class management, not a guarantee of teaching outcomes or a party to every arrangement between users.</p>
          </section>
          <section>
            <h2>Accounts and eligibility</h2>
            <p>Provide accurate information, use the account role that matches your activity, and keep your login credentials private. If a learner is a minor, a parent or guardian should supervise their use of the platform and any in-person tuition arrangements.</p>
          </section>
          <section>
            <h2>Bookings and arrangements</h2>
            <p>A class request is not confirmed until the tutor accepts it. Users are responsible for discussing schedules, tuition fees, payment methods, cancellations, and other arrangements directly. Unless a payment feature is expressly provided, do not assume Shikshak handles or guarantees payments.</p>
          </section>
          <section>
            <h2>Conduct and learning materials</h2>
            <p>Use the platform respectfully. Do not harass, impersonate others, misrepresent qualifications, share unlawful content, or upload files you do not have the right to share. Teachers and students remain responsible for their own notes, homework, messages, and any third-party material they upload.</p>
          </section>
          <section>
            <h2>Safety and privacy</h2>
            <p>Review a tutor's suitability independently before arranging lessons, particularly in person. Keep private addresses and sensitive information out of public listings. A neighbourhood marker is not intended to disclose an exact home location. Report suspected abuse or misuse through the platform's available support or moderation channels.</p>
          </section>
          <section>
            <h2>Availability and enforcement</h2>
            <p>Features may be changed, suspended, or unavailable during testing or maintenance. Shikshak may restrict accounts or remove content that threatens safety, breaks these rules, or violates applicable law. Any final limitations of liability, governing terms, and dispute procedures must be reviewed before public launch.</p>
          </section>
        </>}
        <aside className="legal-draft-note" role="note">
          <strong>Before public launch</strong>
          <p>This is a working draft, not a legally reviewed final notice. The platform operator's legal identity, contact information, and any additional applicable disclosures still need to be confirmed.</p>
        </aside>
      </article>
    </main>
    <SiteFooter variant="auth"/>
  </>;
}
