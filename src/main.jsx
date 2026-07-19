import React, { Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, useScroll, useTransform } from "framer-motion";
import prometheusLogoUrl from "../icons/prometheus-company-icon-512.png";
import {
  buildRouteIqRequestPayload,
  resolveAcquisitionSource,
  submitRouteIqRequest
} from "./route-iq-request-form.js";
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

function Capability({ number, title, body }) {
  return (
    <motion.article
      className="feature-card"
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.48, delay: number * 0.04 }}
    >
      <span>{String(number).padStart(2, "0")}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </motion.article>
  );
}

function RouteIqRequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ kind: "idle", message: "", receiptId: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const formData = Object.fromEntries(new FormData(form).entries());
    formData.consent = form.elements.consent.checked;
    const acquisitionSource = resolveAcquisitionSource(window.location.href, document.referrer);
    const request = buildRouteIqRequestPayload({ formData, acquisitionSource });

    if (!request.ok) {
      setStatus({ kind: "error", message: request.errors.join(" "), receiptId: "" });
      return;
    }

    setSubmitting(true);
    setStatus({ kind: "pending", message: "Submitting your Route IQ request...", receiptId: "" });
    try {
      const result = await submitRouteIqRequest({ payload: request.payload });
      setStatus({
        kind: "success",
        message: result.duplicate
          ? "We found your existing request. Keep this receipt for reference."
          : "Your Route IQ request was accepted. Keep this receipt for reference.",
        receiptId: result.receiptId
      });
      form.reset();
    } catch (error) {
      const messages = {
        REQUEST_RATE_LIMITED: "Too many requests were submitted. Please wait and try again.",
        REQUEST_NETWORK_FAILED: "The request could not reach Prometheus. Your information was not confirmed as stored.",
        REQUEST_RECEIPT_MISSING: "Prometheus could not confirm a storage receipt. Please try again later.",
        REQUEST_RESPONSE_INVALID: "Prometheus returned an invalid confirmation. Please try again later."
      };
      setStatus({
        kind: "error",
        message: messages[error?.message] || "The request was not accepted. Please review the form or try again later.",
        receiptId: ""
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="request-form" onSubmit={handleSubmit} noValidate aria-describedby="request-privacy-note">
      <div className="request-form-grid">
        <label>
          <span>Business name</span>
          <input name="businessName" autoComplete="organization" maxLength="140" required />
        </label>
        <label>
          <span>Contact name</span>
          <input name="contactName" autoComplete="name" maxLength="140" required />
        </label>
        <label>
          <span>Business email</span>
          <input name="businessEmail" type="email" autoComplete="email" inputMode="email" maxLength="180" required />
        </label>
        <label>
          <span>Phone <small>optional</small></span>
          <input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength="40" />
        </label>
        <label>
          <span>Industry or business type</span>
          <input name="industry" maxLength="120" required />
        </label>
        <label>
          <span>Territory or operating area</span>
          <input name="territory" maxLength="220" required />
        </label>
        <label>
          <span>Number of locations</span>
          <input name="locationCount" type="number" inputMode="numeric" min="1" max="10000" required />
        </label>
        <label>
          <span>Estimated number of users</span>
          <input name="estimatedUserCount" type="number" inputMode="numeric" min="1" max="100000" required />
        </label>
        <label className="full-field">
          <span>Primary problem or use case</span>
          <textarea name="primaryProblem" rows="5" maxLength="1200" required />
        </label>
        <label className="full-field">
          <span>Desired timeline</span>
          <select name="desiredTimeline" required defaultValue="">
            <option value="" disabled>Select a timeline</option>
            <option value="Exploring now">Exploring now</option>
            <option value="Within 30 days">Within 30 days</option>
            <option value="Within 90 days">Within 90 days</option>
            <option value="This year">This year</option>
            <option value="No fixed timeline">No fixed timeline</option>
          </select>
        </label>
        <label className="honeypot" aria-hidden="true">
          <span>Website</span>
          <input name="websiteUrl" tabIndex="-1" autoComplete="off" />
        </label>
      </div>

      <label className="consent-field">
        <input name="consent" type="checkbox" required />
        <span>I agree that Prometheus may use this information to respond to my Route IQ request.</span>
      </label>
      <p id="request-privacy-note" className="request-note">
        Prometheus collects only the information needed to review and respond to this request.
      </p>
      <button className="button primary request-submit" type="submit" disabled={submitting}>
        {submitting ? "SUBMITTING" : "REQUEST ROUTE IQ"}
      </button>
      <div className={`request-status ${status.kind}`} role="status" aria-live="polite" aria-atomic="true">
        {status.message && <p>{status.message}</p>}
        {status.receiptId && <p className="receipt-line">Receipt <strong>{status.receiptId}</strong></p>}
      </div>
    </form>
  );
}

function App() {
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.22], [1, 0.92]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0.58]);

  const capabilities = [
    [1, "Plan the field day", "Organize governed business opportunities into a practical route workflow."],
    [2, "Capture verified work", "Record visits, conversations, leads, follow-ups, and outcomes without tracking a representative's whole day."],
    [3, "Understand representatives", "See field activity and outcome patterns through authorized, role-appropriate views."],
    [4, "Understand territories", "Measure evidence coverage, freshness, business-hour eligibility, and local operating context."],
    [5, "Understand customers", "Keep business context and outcomes connected to the workspace that produced them."],
    [6, "Build governed intelligence", "Turn accumulated evidence into read-only, decision-ready intelligence with explicit confidence and limitations."]
  ];

  const evidenceLoop = ["Plan", "Visit", "Capture", "Learn"];

  return (
    <main>
      <a className="skip-link" href="#product">Skip to Route IQ</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Prometheus home">
          <LogoMark scale={0.35} />
          <span className="brand-lockup"><strong>Prometheus</strong><small>Route IQ</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#workflow">Workflow</a>
          <a href="#governance">Governance</a>
          <a href="#request">Request</a>
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
          <motion.div className="hero-copy" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.72 }}>
            <SectionLabel>Prometheus / Active Product</SectionLabel>
            <h1>Route IQ</h1>
            <p>
              Route IQ helps field organizations learn their representatives, territories, customers, and outcomes.
              It turns governed field evidence into decision-ready intelligence while keeping people in control.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#request">REQUEST ROUTE IQ</a>
              <a className="button secondary" href="#product">See the product</a>
            </div>
            <div className="identity-strip" aria-label="Route IQ product pillars">
              <span>Field workflow</span><span>Governed evidence</span><span>Workspace isolation</span><span>Human decisions</span>
            </div>
          </motion.div>
          <aside className="signal-panel" aria-label="Route IQ operating model">
            <div className="panel-header"><LogoMark scale={0.24} /><span>ROUTE IQ OPERATING MODEL</span></div>
            <div className="metric-line"><b>Representatives</b><span>Clear field workflows and fast outcome capture</span></div>
            <div className="metric-line"><b>Leaders</b><span>Evidence freshness, quality, coverage, and trends</span></div>
            <div className="metric-line"><b>Intelligence</b><span>Read-only conclusions with confidence and limitations</span></div>
          </aside>
        </div>
      </section>

      <section id="product" className="section core-section">
        <div className="shell split">
          <div><SectionLabel>One Configurable Product</SectionLabel><h2>Route IQ adapts to the business, not the other way around.</h2></div>
          <p>
            Each organization operates in an isolated workspace with its own locations, territories, roles, goals,
            terminology, measurements, retention rules, and intelligence eligibility. Route IQ remains one product,
            configured for the way each field team works.
          </p>
        </div>
        <div className="shell feature-grid">
          {capabilities.map(([number, title, body]) => <Capability key={title} number={number} title={title} body={body} />)}
        </div>
      </section>

      <section id="workflow" className="section loop-section">
        <div className="shell section-head">
          <SectionLabel>Evidence Loop</SectionLabel>
          <h2>Make field work easier to understand, one governed event at a time.</h2>
          <p className="section-copy">
            Route IQ connects route context, intentional visits, and recorded outcomes. As evidence accumulates,
            leaders gain a clearer read on coverage and trends without presenting uncertain evidence as a proven prediction.
          </p>
        </div>
        <div className="shell loop-track">
          {evidenceLoop.map((item, index) => (
            <div className="loop-step" key={item}><span>{index + 1}</span><strong>{item}</strong></div>
          ))}
        </div>
      </section>

      <section id="governance" className="section governance-section">
        <div className="shell split">
          <div><SectionLabel>Operational Control</SectionLabel><h2>Useful intelligence begins with trustworthy boundaries.</h2></div>
          <p>
            Route IQ separates organizations, users, operating profiles, and evidence. Representatives see only their
            permitted workflows. Governed intelligence remains role-restricted, and recorded evidence retains its source,
            timing, integrity, exclusions, and limitations.
          </p>
        </div>
        <div className="shell trust-grid">
          <article><h3>Workspace isolation</h3><p>Business data stays inside the workspace and operating profile that produced it.</p></article>
          <article><h3>Evidence provenance</h3><p>Authorized records retain source, time window, schema, counts, and integrity context.</p></article>
          <article><h3>Human control</h3><p>Read-only intelligence supports review; it does not silently take operational action.</p></article>
          <article><h3>Measured confidence</h3><p>Insufficient or stale evidence is labeled clearly instead of promoted into a claim.</p></article>
        </div>
      </section>

      <section id="request" className="section request-section">
        <div className="shell request-layout">
          <div className="request-copy">
            <SectionLabel>Route IQ Request</SectionLabel>
            <h2>Tell us how your field organization works.</h2>
            <p>
              Share the operating shape and the problem you need to solve. Prometheus will review the request and use the
              supplied contact information only to follow up about Route IQ.
            </p>
            <div className="request-facts" aria-label="Request process">
              <span>Server-validated submission</span><span>Unique receipt</span><span>Founder review</span>
            </div>
          </div>
          <RouteIqRequestForm />
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div><LogoMark scale={0.42} /><h2>Prometheus</h2><p>Company behind Route IQ.</p></div>
          <div className="footer-links">
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            <a href={instagramUrl}>@prometheus.IQ</a>
            <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a>
          </div>
          <p className="footer-designation"><span>PROMETHEUS ROUTE IQ&trade;</span><span>U.S. PATENT PENDING</span></p>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
