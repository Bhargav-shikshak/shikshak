import { ArrowRight, BadgeCheck, BookOpen, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, Compass, GraduationCap, HeartHandshake, MapPin, MessageCircle, NotebookPen, ShieldCheck, Sparkles, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import './Landing.css';

const sampleTestimonials = [
  {
    quote: 'It would be so much easier to find a tutor who understands our child’s pace and is actually nearby.',
    by: 'Example parent',
    detail: 'Looking for one-to-one tuition',
  },
  {
    quote: 'Being able to request a class and keep homework, notes and schedules in one place sounds really useful.',
    by: 'Example student',
    detail: 'Learning beyond the classroom',
  },
  {
    quote: 'I would love one simple place to show what I teach, set my own fees and respond to class requests.',
    by: 'Example tutor',
    detail: 'Independent home teacher',
  },
];

const learnerSteps = [
  { icon: Compass, title: 'Explore nearby tutors', body: 'Browse available teachers by subject and neighbourhood.' },
  { icon: CalendarDays, title: 'Request a class', body: 'Choose a suitable tutor and send a class request directly.' },
  { icon: NotebookPen, title: 'Keep learning together', body: 'Once accepted, organise lessons, notes and homework in your classroom.' },
];

function LandingAction({ children, secondary = false, href }: { children: ReactNode; secondary?: boolean; href: string }) {
  return <a className={'landing-action' + (secondary ? ' landing-action-secondary' : '')} href={href}>
    {children}<ArrowRight aria-hidden="true" size={18}/>
  </a>;
}

export function Landing({ memberHref }: { memberHref?: string }) {
  const startHref = memberHref || '#signup';
  const teacherHref = memberHref || '#signup/teacher';
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return <div className="landing">
    <a className="skip-link" href="#landing-main" onClick={event => { event.preventDefault(); document.getElementById('landing-main')?.focus(); }}>Skip to content</a>
    <header className="landing-header">
      <div className="landing-header-inner">
        <a className="brand landing-brand" href="#welcome" aria-label="Shikshak landing page">
          <img src="/shikshak-logo.png" width="56" height="56" alt=""/>
          <span>Shik<span>shak</span><b>.</b></span>
        </a>
        <nav className="landing-nav" aria-label="Landing page">
          <button type="button" onClick={() => scrollTo('landing-how')}>How it works</button>
          <button type="button" onClick={() => scrollTo('landing-students')}>For students</button>
          <button type="button" onClick={() => scrollTo('landing-teachers')}>For teachers</button>
          <button type="button" onClick={() => scrollTo('landing-stories')}>Testimonials</button>
        </nav>
        <div className="landing-header-actions">
          {!memberHref && <a className="landing-sign-in" href="#login">Log in</a>}
          <a className="landing-top-cta" href={startHref}>{memberHref ? 'My workspace' : 'Get started'}<ArrowRight size={15} aria-hidden="true"/></a>
        </div>
      </div>
    </header>

    <main id="landing-main" tabIndex={-1}>
      <section className="landing-hero" aria-labelledby="landing-heading">
        <div className="landing-hero-copy">
          <p className="landing-kicker"><span className="landing-kicker-dot"/> LEARNING STARTS CLOSER TO HOME</p>
          <h1 id="landing-heading">The right teacher. <em>Right around the corner.</em></h1>
          <p className="landing-hero-description">Shikshak brings students and independent home tutors together, making it simpler to discover teachers nearby, book a class and keep learning on track.</p>
          <div className="landing-hero-actions">
            <LandingAction href={startHref}>{memberHref ? 'Open my workspace' : 'Find a tutor'}</LandingAction>
            <LandingAction secondary href={teacherHref}>{memberHref ? 'Go to dashboard' : 'I’m a teacher'}</LandingAction>
          </div>
          <p className="landing-hero-note"><ShieldCheck aria-hidden="true" size={17}/> Discover teachers by neighbourhood. Students’ locations are not publicly listed.</p>
        </div>

        <div className="landing-hero-visual" aria-label="Illustration of a sample tutor listing and classroom booking">
          <span className="landing-visual-sun" aria-hidden="true"/>
          <span className="landing-visual-squiggle" aria-hidden="true"/>
          <div className="landing-visual-card">
            <div className="landing-visual-card-head">
              <span><MapPin size={16} aria-hidden="true"/> Your neighbourhood</span>
              <span className="landing-visual-example">ILLUSTRATIVE PREVIEW</span>
            </div>
            <div className="landing-visual-map" aria-hidden="true">
              <span className="landing-map-road landing-map-road-one"/>
              <span className="landing-map-road landing-map-road-two"/>
              <span className="landing-map-road landing-map-road-three"/>
              <span className="landing-map-park landing-map-park-one"/>
              <span className="landing-map-park landing-map-park-two"/>
              <span className="landing-map-pin landing-map-pin-one"><GraduationCap size={17}/></span>
              <span className="landing-map-pin landing-map-pin-two"><BookOpen size={15}/></span>
              <span className="landing-map-label">Guwahati</span>
            </div>
            <div className="landing-visual-tutor">
              <div className="landing-visual-avatar"><GraduationCap size={25}/></div>
              <div><strong>Meet your next tutor</strong><span>Search by subject · Explore nearby</span></div>
              <span className="landing-visual-check"><BadgeCheck size={19} aria-hidden="true"/></span>
            </div>
          </div>
          <div className="landing-floating-note landing-floating-note-one">
            <span className="landing-note-icon"><CheckCircle2 size={21}/></span>
            <span><strong>Class request sent</strong><small>Teachers can accept or decline</small></span>
          </div>
          <div className="landing-floating-note landing-floating-note-two">
            <span className="landing-note-icon purple"><NotebookPen size={20}/></span>
            <span><strong>One shared classroom</strong><small>Notes, homework &amp; schedules</small></span>
          </div>
          <span className="landing-visual-caption">From a neighbour to a learning partner.</span>
        </div>
      </section>

      <section className="landing-benefits" aria-label="What Shikshak helps you do">
        <div><MapPin aria-hidden="true" size={20}/><span>Discover locally</span></div>
        <div><CalendarDays aria-hidden="true" size={20}/><span>Book directly</span></div>
        <div><MessageCircle aria-hidden="true" size={20}/><span>Stay connected</span></div>
        <div><NotebookPen aria-hidden="true" size={20}/><span>Learn in one place</span></div>
      </section>

      <section className="landing-section landing-how" id="landing-how" aria-labelledby="landing-how-heading">
        <div className="landing-section-heading">
          <p className="landing-kicker">A SIMPLER WAY TO LEARN</p>
          <h2 id="landing-how-heading">From “I need a tutor” to <em>“See you in class.”</em></h2>
          <p>Find the right fit without losing track of everything that happens after the first class.</p>
        </div>
        <div className="landing-steps">
          {learnerSteps.map(({ icon: Icon, title, body }, index) => <article className="landing-step" key={title}>
            <div className="landing-step-head"><span className="landing-step-icon"><Icon size={25} aria-hidden="true"/></span><span className="landing-step-number">0{index + 1}</span></div>
            <h3>{title}</h3><p>{body}</p>
          </article>)}
        </div>
      </section>

      <section className="landing-section landing-role-section" aria-label="Who Shikshak is for">
        <article className="landing-role-card landing-role-student" id="landing-students">
          <span className="landing-role-icon"><BookOpen size={25} aria-hidden="true"/></span>
          <p className="landing-kicker">FOR STUDENTS &amp; FAMILIES</p>
          <h2>Learn your way, <em>close to home.</em></h2>
          <p>Compare local tutors, request a class and manage your learning after a teacher accepts your booking.</p>
          <ul>
            <li><CheckCircle2 size={17} aria-hidden="true"/> Subject-based tutor discovery</li>
            <li><CheckCircle2 size={17} aria-hidden="true"/> Class booking requests</li>
            <li><CheckCircle2 size={17} aria-hidden="true"/> Class notes, homework and schedules</li>
          </ul>
          <a href={startHref}>{memberHref ? 'Go to my workspace' : 'Find my tutor'} <ChevronRight size={19} aria-hidden="true"/></a>
        </article>
        <article className="landing-role-card landing-role-teacher" id="landing-teachers">
          <span className="landing-role-icon"><GraduationCap size={25} aria-hidden="true"/></span>
          <p className="landing-kicker">FOR INDEPENDENT TUTORS</p>
          <h2>Your teaching, <em>your terms.</em></h2>
          <p>Build your profile, set your own base rate and manage class requests from students looking for help.</p>
          <ul>
            <li><CheckCircle2 size={17} aria-hidden="true"/> Set your subjects and tuition fees</li>
            <li><CheckCircle2 size={17} aria-hidden="true"/> Teacher profiles reviewed by admins</li>
            <li><CheckCircle2 size={17} aria-hidden="true"/> Manage lessons and student work</li>
          </ul>
          <a href={teacherHref}>{memberHref ? 'Open my workspace' : 'Start teaching'} <ChevronRight size={19} aria-hidden="true"/></a>
        </article>
      </section>

      <section className="landing-section landing-trust" aria-labelledby="landing-trust-heading">
        <div className="landing-section-heading">
          <p className="landing-kicker">BUILT AROUND REAL LEARNING</p>
          <h2 id="landing-trust-heading">Thoughtful details <em>for both sides.</em></h2>
        </div>
        <div className="landing-trust-grid">
          <div><ShieldCheck size={26} aria-hidden="true"/><h3>Privacy by design</h3><p>Students do not appear in the public tutor discovery map.</p></div>
          <div><BadgeCheck size={26} aria-hidden="true"/><h3>Teacher verification</h3><p>Teachers can be reviewed and verified by platform administrators.</p></div>
          <div><HeartHandshake size={26} aria-hidden="true"/><h3>You're in control</h3><p>Students request classes; teachers decide which requests to accept.</p></div>
          <div><ClipboardCheck size={26} aria-hidden="true"/><h3>Made for the lessons</h3><p>Share notes, keep track of assignments and plan upcoming classes.</p></div>
        </div>
      </section>

      <section className="landing-section landing-stories" id="landing-stories" aria-labelledby="landing-stories-heading">
        <div className="landing-stories-heading">
          <div><p className="landing-kicker">REVIEWS & TESTIMONIALS</p><h2 id="landing-stories-heading">A little word of <em>mouth.</em></h2></div>
          <p className="landing-placeholder-disclosure"><Sparkles size={17} aria-hidden="true"/> Sample testimonials for layout preview only. These are fictional examples, not real customer feedback or ratings.</p>
        </div>
        <div className="landing-story-grid">
          {sampleTestimonials.map(({ quote, by, detail }) => <figure className="landing-story" key={by}>
            <div className="landing-story-stars" aria-label="Decorative sample rating">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={16} fill="currentColor" aria-hidden="true"/>)}</div>
            <blockquote>“{quote}”</blockquote>
            <figcaption><span className="landing-story-avatar" aria-hidden="true">{by.split(' ')[1].slice(0, 1)}</span><span><strong>{by}</strong><small>{detail}</small></span><span className="landing-story-sample">Sample</span></figcaption>
          </figure>)}
        </div>
      </section>

      <section className="landing-closing" aria-labelledby="landing-closing-heading">
        <span className="landing-closing-doodle" aria-hidden="true"><GraduationCap size={75}/></span>
        <p className="landing-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
        <h2 id="landing-closing-heading">A good lesson can <em>change everything.</em></h2>
        <p>Whether you want to learn something new or help someone move forward, there’s a place for you at Shikshak.</p>
        <div className="landing-hero-actions">
          <LandingAction href={startHref}>{memberHref ? 'My workspace' : 'Get started as a student'}</LandingAction>
          <LandingAction secondary href={teacherHref}>{memberHref ? 'Open dashboard' : 'Join as a tutor'}</LandingAction>
        </div>
      </section>
    </main>
  </div>;
}
