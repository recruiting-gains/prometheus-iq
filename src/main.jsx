import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { motion, useScroll, useTransform } from "framer-motion";
import prometheusLogoUrl from "../icons/prometheus.svg";
import "./styles.css";

const contactEmail = "prometheusrouteiq@gmail.com";
const instagramUrl = "https://www.instagram.com/prometheus.IQ";
const IntelligenceScene = React.lazy(() => import("./IntelligenceScene.jsx"));

function LogoMark({ scale = 1 }) {
  return (
    <div className="logo-mark" style={{ "--scale": scale }}>
      <img src={prometheusLogoUrl} alt="" width="512" height="512" />
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="eyebrow">{children}</p>;
}

function FeatureCard({ title, body, index }) {
  return (
    <motion.article
      className="feature-card"
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay: index * 0.05 }}
    >
      <span>{String(index + 1).padStart(2, "0")}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </motion.article>
  );
}

function App() {
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.22], [1, 0.9]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0.56]);

  const features = [
    ["Next-Best Stop", "Prioritize the field day around qualified places before miles are wasted."],
    ["Verified Activity", "Attach intentional visit context to business activity without tracking a rep's whole day."],
    ["Simple Outcome Capture", "Log conversations, leads, follow-ups, and wins quickly so the rep stays in motion."],
    ["Manager Visibility", "Give leaders a clearer picture of field effort, route quality, and results."],
    ["CRM-Adjacent Workflow", "Support the work that happens before a lead becomes clean CRM data."],
    ["Learning Loop", "Turn repeated field activity into governed operating intelligence over time."]
  ];

  const loop = ["Route", "Visit", "Result", "Recommendation"];
  const industries = ["Fitness", "Roofing", "Medical Sales", "Franchise Teams", "B2B Services", "Local Market Growth"];
  const trustSignals = [
    ["Founder-built", "Designed from real outside-sales work, not a generic CRM dashboard."],
    ["Public/private separation", "The marketing site remains separate from authenticated beta systems."],
    ["Controlled beta", "Pilot requests are reviewed before access, scope, or implementation is discussed."]
  ];

  return (
    <main>
      <a className="skip-link" href="#core">Skip to product overview</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Prometheus home">
          <LogoMark scale={0.35} />
          <span className="brand-lockup">
            <strong>Prometheus</strong>
            <small>Prometheus IQ</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#core">Core</a>
          <a href="#features">Features</a>
          <a href="#pilot">Pilot</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section id="top" className="hero-section">
        <motion.div className="hero-scene" style={{ scale: heroScale, opacity: heroOpacity }}>
          <Suspense fallback={<div className="scene-fallback"><LogoMark scale={1.15} /></div>}>
            <IntelligenceScene />
          </Suspense>
        </motion.div>
        <div className="hero-shade" />
        <div className="shell hero-grid">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <SectionLabel>Prometheus IQ by Prometheus</SectionLabel>
            <h1>AI Route Intelligence for Outside Sales Teams.</h1>
            <p>
              Prometheus IQ helps field teams decide where to go next, verify what happened,
              and turn every visit into clearer territory intelligence across the industries
              that still grow through face-to-face selling.
            </p>
            <div className="hero-actions">
              <a className="button primary" href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Beta%20Pilot%20Request`}>Apply for Beta Pilot</a>
              <a className="button secondary" href="#core">See How It Works</a>
            </div>
            <div className="identity-strip" aria-label="Prometheus identity pillars">
              <span>Outside Sales</span>
              <span>AI Route Intelligence</span>
              <span>Verified Activity</span>
              <span>Controlled Beta</span>
            </div>
            <p className="cta-note">Built for teams in fitness, home services, healthcare, franchise growth, B2B services, and any local market where real visits still matter.</p>
          </motion.div>
          <motion.aside
            className="signal-panel"
            initial={{ opacity: 0, x: 34 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: "easeOut" }}
          >
            <div className="panel-header">
              <LogoMark scale={0.24} />
              <span>LIVE FIELD READ</span>
            </div>
            <div className="metric-line">
              <b>Where to go</b>
              <span>AI Route Intelligence</span>
            </div>
            <div className="metric-line">
              <b>What happened</b>
              <span>Verified visit outcomes</span>
            </div>
            <div className="metric-line">
              <b>What improves</b>
              <span>Enterprise operating intelligence</span>
            </div>
          </motion.aside>
        </div>
      </section>

      <section id="core" className="section core-section">
        <div className="shell split">
          <div>
            <SectionLabel>The Intelligence Core</SectionLabel>
            <h2>Prometheus makes the work before the CRM measurable.</h2>
          </div>
          <p>
            Prometheus IQ is the flagship product inside a broader outside-sales operating system:
            AI Route Intelligence, verified activity, opportunity context, follow-up signals,
            and field outcomes converging into one governed operating picture.
          </p>
        </div>
        <div className="shell core-window">
          <div className="map-glow" />
          <div className="route-map">
            <span className="pin one" />
            <span className="pin two" />
            <span className="pin three" />
            <span className="pin four" />
            <svg viewBox="0 0 900 260" role="img" aria-label="Abstract route intelligence visualization">
              <path d="M38 180 C 170 42, 280 230, 410 118 S 615 36, 842 130" />
              <path d="M122 82 C 260 138, 345 24, 482 92 S 685 224, 818 82" />
            </svg>
          </div>
        </div>
      </section>

      <section className="section trust-section" aria-labelledby="trust-title">
        <div className="shell section-head">
          <SectionLabel>Public Trust Signals</SectionLabel>
          <h2 id="trust-title">Built for serious pilots, not anonymous signups.</h2>
        </div>
        <div className="shell trust-grid">
          {trustSignals.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section problem-section">
        <div className="shell">
          <SectionLabel>The Problem</SectionLabel>
          <h2>Traditional systems record what happened. Prometheus helps decide what should happen next.</h2>
          <p className="section-copy">That matters anywhere teams sell through territory visits, community outreach, local partnerships, canvassing, events, or multi-location field growth.</p>
          <div className="industry-strip" aria-label="Industries Prometheus IQ can support">
            {industries.map((industry) => <span key={industry}>{industry}</span>)}
          </div>
          <div className="problem-grid">
            {[
              ["Where to go.", "Field teams need a sharper starting point before they burn time and fuel."],
              ["When to go.", "Timing matters when the goal is to turn real conversations into measurable outcomes."],
              ["What opportunities matter.", "Not every stop deserves the same attention. Prometheus helps focus the day."]
            ].map(([item, body]) => (
              <article key={item}>
                <span />
                <h3>{item}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="section features-section">
        <div className="shell section-head">
          <SectionLabel>Platform Capabilities</SectionLabel>
          <h2>Built as an operating system for teams who still win in the physical world.</h2>
          <p className="section-copy">Prometheus IQ is not limited to gyms. It is positioned for any outside-sales organization that needs better territory direction, verified field activity, and cleaner management visibility.</p>
        </div>
        <div className="shell feature-grid">
          {features.map(([title, body], index) => <FeatureCard key={title} title={title} body={body} index={index} />)}
        </div>
      </section>

      <section className="section loop-section">
        <div className="shell">
          <SectionLabel>The Learning Loop</SectionLabel>
          <h2>AI Route Intelligence improves as the field produces evidence.</h2>
          <div className="loop-track">
            {loop.map((item, index) => (
              <motion.div
                className="loop-step"
                key={item}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.1 }}
              >
                <span>{index + 1}</span>
                <strong>{item}</strong>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section founder-section">
        <div className="shell founder-grid">
          <div>
            <SectionLabel>Founder Story</SectionLabel>
            <h2>Founder-led innovation, built from the road.</h2>
          </div>
          <div className="founder-copy">
            <p>
              Prometheus was created by a field salesperson who lived the reality of wasted miles,
              dead zones, inefficient routes, and a lack of real intelligence for the person doing the work outside.
            </p>
            <p>
              The mission is to give road warriors a stronger path through Prometheus IQ:
              less guessing, more verified activity, responsible controls, and a field system
              that grows from real results.
            </p>
            <p className="testimonial-placeholder">
              Pilot testimonial placeholder: reserved for an approved customer quote after the first controlled beta results are reviewed.
            </p>
          </div>
        </div>
      </section>

      <section id="pilot" className="section pilot-section">
        <div className="shell pilot-card">
          <div>
            <SectionLabel>Beta Request Flow</SectionLabel>
            <h2>Apply for a controlled Prometheus IQ beta pilot.</h2>
            <p>
              Pilot partners can evaluate AI Route Intelligence, GPS verified activity,
              sales intelligence, and productivity metrics through a controlled private program
              designed for founder-led implementation and executive review.
            </p>
            <div className="beta-steps" aria-label="Beta request steps">
              <span>1. Apply</span>
              <span>2. Founder review</span>
              <span>3. Pilot scope</span>
            </div>
            <p className="investor-note">Investor signal: Prometheus IQ is being positioned as a repeatable field-intelligence layer across multiple outside-sales verticals.</p>
          </div>
          <a className="button primary" href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Beta%20Pilot%20Request`}>Apply for Beta Pilot</a>
        </div>
      </section>

      <footer id="contact" className="site-footer">
        <div className="shell footer-grid">
          <div>
            <LogoMark scale={0.42} />
            <h2>Prometheus</h2>
            <p>Building Prometheus IQ and the AI operating system for outside sales.</p>
          </div>
          <div className="footer-links">
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            <a href={instagramUrl}>@prometheus.IQ</a>
            <a href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Beta%20Pilot%20Request`}>Apply for Beta Pilot</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
