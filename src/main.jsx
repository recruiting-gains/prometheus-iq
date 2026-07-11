import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { motion, useScroll, useTransform } from "framer-motion";
import prometheusLogoUrl from "../icons/prometheus-company-icon-512.png";
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
  const industries = [
    ["Home Services", "Roofing, HVAC, pest, solar, and security teams."],
    ["Healthcare", "Medical device, referral, and provider outreach teams."],
    ["Commercial Services", "Facilities, cleaning, logistics, uniforms, and B2B service sellers."],
    ["Retail & Franchise", "Multi-location growth, memberships, partnerships, and events."],
    ["B2B Sales", "Payroll, telecom, insurance, industrial, and territory acquisition."]
  ];
  const enterpriseSignals = [
    ["Operational onboarding", "Defined scope, success criteria, review cadence, and executive evaluation before expansion."],
    ["Security posture", "Public marketing remains separate from authenticated systems, internal logic, and private operating data."],
    ["Manager visibility", "Leadership sees field execution, route usefulness, and outcomes without turning Prometheus into surveillance."],
    ["CRM-adjacent adoption", "Prometheus strengthens the work before clean pipeline data exists, then informs downstream systems."]
  ];
  const investorSignals = [
    ["Horizontal market", "Outside sales spans healthcare, home services, insurance, telecom, franchise growth, and B2B services."],
    ["Compounding data", "Every verified visit and outcome can improve territory intelligence, coaching, and next-best-action quality."],
    ["Founder-market fit", "Prometheus began in real field-sales pressure, with gym sales as validation rather than category definition."],
    ["Enterprise path", "The operating model supports qualified partner onboarding, customer success reviews, renewal discipline, and expansion."]
  ];
  const successFramework = [
    ["Baseline", "Document current routing, visit volume, follow-up discipline, and manager visibility."],
    ["Onboard", "Configure the operating profile and run a focused workflow against route quality, activity proof, conversion path, and adoption."],
    ["Review", "Translate field evidence into executive readouts, success gaps, and expansion criteria."],
    ["Scale", "Move from founder-led setup to repeatable onboarding, governance, and customer success rhythm."]
  ];
  const trustSignals = [
    ["Founder Built", "Built from real outside-sales pressure and field execution gaps."],
    ["Controlled Onboarding", "Scoped access, defined users, and clear readiness review."],
    ["Enterprise Ready", "Governance, separation, and success discipline from day one."],
    ["Outcome Focused", "Evaluation centers on routes, activity proof, and field results."]
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
          <a href="#enterprise">Enterprise</a>
          <a href="#industries">Industries</a>
          <a href="#investors">Investors</a>
          <a href="#partner">Partner Intake</a>
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
            <div className="patent-badge" aria-label="U.S. patent pending technology">U.S. PATENT PENDING TECHNOLOGY</div>
            <h1>AI Route Intelligence for Outside Sales Teams.</h1>
            <p>
              At Prometheus, we make it our business to know who sits in front of you before you ever shake their hand.
              By transforming evidence into decision-ready intelligence, we help organizations reduce uncertainty before
              important business decisions—from outside sales and franchise development to future operational intelligence
              across every industry where preparation creates an advantage.
            </p>
            <div className="hero-actions">
              <a className="button primary" href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Growth%20Partner%20Application`}>Request Access</a>
              <a className="button secondary" href="#enterprise">Enterprise Readiness</a>
            </div>
            <div className="identity-strip" aria-label="Prometheus identity pillars">
              <span>Outside Sales</span>
              <span>AI Route Intelligence</span>
              <span>Verified Activity</span>
              <span>Partner Onboarding</span>
            </div>
            <p className="cta-note">Built for healthcare, home services, franchise growth, telecom, insurance, B2B services, and any team where revenue depends on intelligent field execution.</p>
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
          <h2 id="trust-title">Managed enterprise deployments for teams that need field intelligence with control.</h2>
          <p className="section-copy">Prometheus IQ is evaluated through defined rollout scope, executive success criteria, and founder-led implementation discipline before broader deployment.</p>
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

      <section id="industries" className="section problem-section">
        <div className="shell">
          <SectionLabel>Industry Pages</SectionLabel>
          <h2>Prometheus is horizontal outside-sales infrastructure, not a single-market tool.</h2>
          <p className="section-copy">Gym sales remains the first production validation environment. The company category is broader: any organization that creates revenue through territory visits, local outreach, canvassing, appointments, partner development, or field-led demand creation.</p>
          <div className="industry-pages" aria-label="Industries Prometheus IQ can support">
            {industries.map(([title, body]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className="problem-grid">
            {[
              ["Reduce Drive Time", "Prioritize territory moves before miles are wasted."],
              ["Recover Selling Time", "Turn unclear field days into focused visits and follow-up."],
              ["Verify Field Activity", "Give managers proof of intentional work without surveillance."]
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

      <section id="enterprise" className="section enterprise-section">
        <div className="shell split">
          <div>
            <SectionLabel>Enterprise Page</SectionLabel>
            <h2>Built for private onboarding, executive review, and field operating discipline.</h2>
          </div>
          <p>
            Qualified partners need more than a route map. Prometheus frames onboarding around
            route quality, verified activity, qualified lead generation, operating profile configuration,
            adoption, and leadership visibility while keeping private systems and internal intelligence logic protected.
          </p>
        </div>
        <div className="shell enterprise-grid">
          {enterpriseSignals.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
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
          <h2>Make outside sales intelligent, directed, accountable, and compounding.</h2>
          <p className="section-copy">Every route, visit, and outcome should make tomorrow's field decision smarter.</p>
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
            <h2>Founder-led, field-tested, and built for enterprise trust.</h2>
          </div>
          <div className="founder-copy">
            <p>
              Prometheus was created from lived outside-sales reality: wasted miles, dead zones,
              unclear priorities, inconsistent follow-up, and the pressure to create demand in
              the physical world without intelligent direction.
            </p>
            <p>
              The mission is larger than one vertical. Prometheus IQ is the first product in an
              AI operating system for outside sales, built to make field work directed,
              accountable, measurable, and compounding without becoming a surveillance product.
            </p>
            <p className="testimonial-placeholder">
              Partner testimonial placeholder: reserved for an approved customer quote after qualified partner onboarding results are reviewed.
            </p>
          </div>
        </div>
      </section>

      <section className="section vision-section">
        <div className="shell split">
          <div>
            <SectionLabel>Company Direction</SectionLabel>
            <h2>Our Long-Term Vision</h2>
          </div>
          <p>
            Prometheus helps organizations reduce uncertainty before important business decisions
            by transforming evidence into decision-ready intelligence.
          </p>
        </div>
        <div className="shell success-grid" aria-label="Prometheus long-term platform vision">
          {[
            ["Better evidence", "We believe better decisions begin with better evidence."],
            ["Decision-ready intelligence", "Every research dossier, qualification process, operating profile, executive brief, and intelligence workflow exists to reduce uncertainty before a human makes an important business decision."],
            ["Platform evolution", "Outside sales is where Prometheus began. Decision intelligence is where the platform is evolving."]
          ].map(([title, body], index) => (
            <article key={title}>
              <span>{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="investors" className="section investor-section">
        <div className="shell split">
          <div>
            <SectionLabel>Investor Page</SectionLabel>
            <h2>Prometheus is building the intelligence layer for outside sales.</h2>
          </div>
          <p>
            The investor story is not routing software. It is a repeatable operating layer for
            where reps go, what happened, what the team learned, and how field execution improves
            across broad outside-sales markets.
          </p>
        </div>
        <div className="shell investor-grid">
          {investorSignals.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section success-section">
        <div className="shell section-head">
          <SectionLabel>Customer Success Framework</SectionLabel>
          <h2>From partner intake to expansion-ready operating review.</h2>
          <p className="section-copy">Prometheus onboarding is designed to create evidence: cleaner route decisions, verified work, qualified lead generation, useful outcomes, and a clear executive path for renewal or expansion.</p>
        </div>
        <div className="shell success-grid">
          {successFramework.map(([title, body], index) => (
            <article key={title}>
              <span>{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="partner" className="section partner-section">
        <div className="shell partner-card">
          <div>
            <SectionLabel>Partner Intake</SectionLabel>
            <h2>Apply for private Prometheus IQ operational onboarding.</h2>
            <p>
              Prometheus IQ is now accepting qualified businesses, franchise groups, and
              outside-sales organizations for onboarding based on business fit, operating profile,
              and security readiness. Request a private demo, apply for growth partnership,
              request enterprise pricing, or schedule discovery.
            </p>
            <div className="partner-steps" aria-label="Partner intake steps">
              <span>1. Request</span>
              <span>2. Operating profile</span>
              <span>3. CRM packet</span>
              <span>4. Founder review</span>
            </div>
            <p className="investor-note">Investor signal: Prometheus IQ is positioned as repeatable field-intelligence infrastructure across multiple outside-sales verticals.</p>
          </div>
          <a className="button primary" href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Growth%20Partner%20Application`}>Apply for Growth Partnership</a>
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
            <a href={`mailto:${contactEmail}?subject=Prometheus%20IQ%20Growth%20Partner%20Application`}>Apply for Growth Partnership</a>
          </div>
          <p className="footer-designation"><span>PROMETHEUS ROUTE IQ&trade;</span><span>U.S. PATENT PENDING</span></p>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
