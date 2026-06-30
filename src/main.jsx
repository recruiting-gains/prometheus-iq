import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { motion, useScroll, useTransform } from "framer-motion";
import "./styles.css";

const contactEmail = "prometheusrouteiq@gmail.com";
const instagramUrl = "https://www.instagram.com/prometheus.IQ";
const IntelligenceScene = React.lazy(() => import("./IntelligenceScene.jsx"));

function FlameMark({ scale = 1 }) {
  return (
    <div className="flame-mark" style={{ "--scale": scale }}>
      <div className="flame-outer" />
      <div className="flame-inner" />
      <div className="flame-core" />
      <div className="flame-base">
        <span />
      </div>
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
    ["AI Route Intelligence", "Prioritize the field day around places that deserve attention before miles are wasted."],
    ["GPS Verification", "Attach verified visit context to business activity without tracking a rep's whole day."],
    ["Visit Logging", "Capture the outcome of each stop quickly so the rep stays in motion."],
    ["Manager Visibility", "Give leaders a clearer picture of field effort, activity, and results."],
    ["Follow-Up Tracking", "Keep opportunities from disappearing after the first conversation."],
    ["Enterprise Intelligence Layer", "Turn repeated field activity into governed operating intelligence over time."]
  ];

  const loop = ["Route", "Visit", "Result", "Recommendation"];

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Prometheus home">
          <FlameMark scale={0.35} />
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
          <Suspense fallback={<div className="scene-fallback"><FlameMark scale={1.15} /></div>}>
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
            <SectionLabel>Prometheus IQ, the flagship product from Prometheus</SectionLabel>
            <h1>The AI Operating System for Outside Sales.</h1>
            <p>
              Prometheus is building an enterprise-ready intelligence layer for the field.
              Prometheus IQ brings AI Route Intelligence, verified activity, and learning loops
              into one operating system for outside sales teams.
            </p>
            <div className="hero-actions">
              <a className="button primary" href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Pilot%20Request`}>Request Pilot</a>
              <a className="button secondary" href="#core">View Demo</a>
            </div>
            <div className="identity-strip" aria-label="Prometheus identity pillars">
              <span>Prometheus</span>
              <span>Prometheus IQ</span>
              <span>AI Route Intelligence</span>
              <span>Enterprise Ready</span>
            </div>
          </motion.div>
          <motion.aside
            className="signal-panel"
            initial={{ opacity: 0, x: 34 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: "easeOut" }}
          >
            <div className="panel-header">
              <FlameMark scale={0.24} />
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
            <h2>Prometheus is bigger than a single-feature sales app.</h2>
          </div>
          <p>
            Prometheus IQ is the flagship product inside a broader outside-sales operating system.
            AI Route Intelligence, GPS-verified activity, opportunity context, follow-up signals,
            and field outcomes converge into one governed operating picture.
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

      <section className="section problem-section">
        <div className="shell">
          <SectionLabel>The Problem</SectionLabel>
          <h2>Traditional systems record what happened. Prometheus helps determine what should happen next.</h2>
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
              less guessing, more verified activity, enterprise-grade controls, and a field system
              that grows from real results.
            </p>
          </div>
        </div>
      </section>

      <section id="pilot" className="section pilot-section">
        <div className="shell pilot-card">
          <div>
            <SectionLabel>Enterprise Readiness</SectionLabel>
            <h2>Now Accepting Prometheus IQ Pilot Partners</h2>
            <p>
              Pilot partners can evaluate AI Route Intelligence, GPS verified activity,
              sales intelligence, and productivity metrics through a controlled private program
              designed for founder-led implementation and enterprise review.
            </p>
          </div>
          <a className="button primary" href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Pilot%20Partner`}>Request Pilot</a>
        </div>
      </section>

      <footer id="contact" className="site-footer">
        <div className="shell footer-grid">
          <div>
            <FlameMark scale={0.42} />
            <h2>Prometheus</h2>
            <p>Building Prometheus IQ and the AI operating system for outside sales.</p>
          </div>
          <div className="footer-links">
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            <a href={instagramUrl}>@prometheus.IQ</a>
            <a href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Pilot%20Request`}>Request Pilot</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
