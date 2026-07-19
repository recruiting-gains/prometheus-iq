import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
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

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    const context = window.WebGL2RenderingContext
      ? canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
      : window.WebGLRenderingContext
        ? canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true })
        : null;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

function HeroFallback() {
  return (
    <div className="hero-fallback" data-visual-fallback="field-operations" aria-hidden="true">
      <img
        src="/route-iq-field-operations.jpg"
        alt=""
        width="1600"
        height="900"
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}

class HeroSceneBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <HeroFallback />;
    return this.props.children;
  }
}

function HeroVisual() {
  const [mode, setMode] = useState("pending");

  useEffect(() => {
    let cancelled = false;
    let idleHandle;
    let timeoutHandle;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const cancelActivation = () => {
      if (idleHandle !== undefined && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
      idleHandle = undefined;
      timeoutHandle = undefined;
    };

    const evaluate = () => {
      cancelActivation();
      if (reducedMotion.matches || connection?.saveData || !supportsWebGl()) {
        setMode("fallback");
        return;
      }

      setMode("pending");
      const activate = () => {
        if (!cancelled) setMode("scene");
      };
      if (window.requestIdleCallback) idleHandle = window.requestIdleCallback(activate, { timeout: 1200 });
      else timeoutHandle = window.setTimeout(activate, 1);
    };

    evaluate();
    reducedMotion.addEventListener?.("change", evaluate);
    connection?.addEventListener?.("change", evaluate);
    return () => {
      cancelled = true;
      cancelActivation();
      reducedMotion.removeEventListener?.("change", evaluate);
      connection?.removeEventListener?.("change", evaluate);
    };
  }, []);

  if (mode === "fallback") return <HeroFallback />;
  if (mode === "pending") return <div className="hero-scene-loading" data-visual-mode="pending" aria-hidden="true" />;

  return (
    <div className="hero-scene-canvas" data-visual-mode="scene" aria-hidden="true">
      <HeroSceneBoundary>
        <Suspense fallback={<div className="hero-scene-loading" data-visual-mode="loading" aria-hidden="true" />}>
          <IntelligenceScene />
        </Suspense>
      </HeroSceneBoundary>
    </div>
  );
}

function LogoMark() {
  return <img className="logo-mark" src={prometheusLogoUrl} alt="" width="512" height="512" />;
}

function SectionLabel({ children }) {
  return <p className="eyebrow">{children}</p>;
}

function ProductView() {
  const stops = [
    ["01", "North district", "Visited", "Outcome recorded"],
    ["02", "Service corridor", "Next", "Verified open"],
    ["03", "Market center", "Queued", "Context ready"],
    ["04", "West territory", "Queued", "Hours verified"]
  ];

  return (
    <figure className="product-view" aria-labelledby="product-view-title">
      <div className="product-toolbar">
        <div className="product-brand"><LogoMark /><span>Route IQ</span></div>
        <div className="product-context"><span>Today</span><strong>Field queue</strong></div>
        <div className="product-avatar" aria-label="Synthetic representative">FR</div>
      </div>
      <div className="product-body">
        <div className="product-route">
          <div className="product-route-head">
            <div><span className="product-kicker">Representative workflow</span><h3 id="product-view-title">A governed field day</h3></div>
            <span className="product-count">15 stops</span>
          </div>
          <div className="route-list">
            {stops.map(([number, place, state, detail]) => (
              <div className="route-row" key={number}>
                <span className={`route-number state-${state.toLowerCase()}`}>{number}</span>
                <span className="route-place"><strong>{place}</strong><small>{detail}</small></span>
                <span className="route-state">{state}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="product-intelligence">
          <div className="product-intelligence-head"><span>Leader view</span><strong>Evidence health</strong></div>
          <div className="quality-gauge" aria-label="Evidence quality is governed and measured">
            <span>Coverage</span><i style={{ "--value": "72%" }} /><b>Measured</b>
          </div>
          <div className="quality-gauge">
            <span>Freshness</span><i style={{ "--value": "84%" }} /><b>Current</b>
          </div>
          <div className="quality-gauge">
            <span>Confidence</span><i style={{ "--value": "39%" }} /><b>Insufficient</b>
          </div>
          <div className="boundary-note"><span>Human decision</span><p>Evidence is organized for review. No automatic route change or recommendation is shown.</p></div>
        </div>
      </div>
      <figcaption>Synthetic product view. No customer or representative data is shown.</figcaption>
    </figure>
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
    setStatus({ kind: "pending", message: "Validating your Route IQ request...", receiptId: "" });
    try {
      const result = await submitRouteIqRequest({ payload: request.payload });
      setStatus({
        kind: "success",
        message: result.duplicate
          ? "Your existing request was found. The original receipt remains valid."
          : "Your request was accepted and stored for Founder review.",
        receiptId: result.receiptId
      });
      form.reset();
    } catch (error) {
      const messages = {
        REQUEST_RATE_LIMITED: "Too many requests were submitted. Please wait before trying again.",
        REQUEST_NETWORK_FAILED: "Prometheus could not confirm that your request was stored. Please try again later.",
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
    <form className="request-form" onSubmit={handleSubmit} noValidate aria-describedby="request-privacy-note request-process-note">
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
      <p id="request-privacy-note" className="request-note">Only the information needed to review and respond to this request is collected.</p>
      <p id="request-process-note" className="request-note">Success appears only after durable acceptance. You will receive a unique receipt; Prometheus then reviews the request and may follow up.</p>
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
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const sceneScale = useTransform(scrollYProgress, [0, 0.22], [1, 0.92]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0.58]);
  const lifecycle = [
    ["01", "Governed field evidence", "Authorized records retain source, time, schema, quality, exclusions, and integrity context."],
    ["02", "Governed intelligence", "Leaders can review coverage, freshness, trends, and learning state without changing a representative's workflow."],
    ["03", "Qualified probability", "Only sufficient, chronologically valid evidence may support a versioned estimate with confidence and limitations."],
    ["04", "Human decision", "A person remains responsible for the operational choice. Route IQ does not act automatically."]
  ];

  const differences = [
    ["Route planner", "Orders stops and manages travel.", "Route IQ preserves the evidence, context, chronology, and outcomes around field decisions."],
    ["CRM", "Records contacts, pipeline, and interactions.", "Route IQ connects field actions to territory context, evidence quality, and a governed learning loop."],
    ["Maps", "Shows locations and navigation.", "Route IQ records why an opportunity was available, what happened, and what the evidence supports."],
    ["Generic AI", "Generates open-ended responses from broad context.", "Route IQ uses allowlisted, versioned, isolated evidence with explicit exclusions and human control."]
  ];

  return (
    <main>
      <a className="skip-link" href="#how-it-works">Skip to how Route IQ works</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Prometheus Route IQ home">
          <LogoMark />
          <span className="brand-lockup"><strong>Prometheus</strong><small>Route IQ</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#different">Why Route IQ</a>
          <a className="header-action" href="#request">REQUEST ROUTE IQ</a>
        </nav>
      </header>

      <section id="top" className="hero-section">
        <motion.div
          className="hero-scene"
          style={{
            scale: prefersReducedMotion ? 1 : sceneScale,
            opacity: prefersReducedMotion ? 1 : sceneOpacity
          }}
        >
          <HeroVisual />
        </motion.div>
        <div className="hero-shade" aria-hidden="true" />
        <motion.div
          className="shell hero-copy"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.72 }}
        >
          <SectionLabel>Prometheus / Field decision intelligence</SectionLabel>
          <h1>Route IQ</h1>
          <p className="hero-statement">Turn field evidence into decision-ready intelligence.</p>
          <p className="hero-detail">Built for the field operations leader accountable for distributed teams, and the representative visiting businesses or locations every day.</p>
          <p className="hero-difference">Route IQ connects representatives, territories, customer context, and outcomes. It is not another route planner, CRM, map, or generic AI assistant.</p>
          <div className="hero-actions">
            <a className="button primary" href="#request">REQUEST ROUTE IQ</a>
            <a className="button secondary" href="#how-it-works">See How Route IQ Works</a>
          </div>
        </motion.div>
        <div className="hero-proof" aria-label="Route IQ operating principles">
          <span><b>Evidence</b> with provenance</span>
          <span><b>Intelligence</b> with limitations</span>
          <span><b>Decisions</b> remain human</span>
        </div>
      </section>

      <section id="how-it-works" className="section problem-section">
        <div className="shell problem-layout">
          <div>
            <SectionLabel>The operating problem</SectionLabel>
            <h2>The field knows more than the systems do.</h2>
          </div>
          <div className="problem-copy">
            <p>Routes get planned and visits get logged, but the evidence stays fragmented across people, territories, customer context, and outcomes.</p>
            <p>Route IQ governs that evidence as one decision-support lifecycle, so leaders can see what is known, what is stale, what is missing, and what remains uncertain.</p>
          </div>
        </div>
      </section>

      <section className="section product-section">
        <div className="shell section-intro">
          <SectionLabel>The product</SectionLabel>
          <h2>A field workflow representatives can use. An evidence system leaders can trust.</h2>
          <p>Representatives plan, visit, and record outcomes through role-appropriate workflows. Leaders review governed evidence quality and trends. Protected intelligence stays separate from representative operations.</p>
        </div>
        <motion.div
          className="shell"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.52 }}
        >
          <ProductView />
        </motion.div>
      </section>

      <section className="section lifecycle-section">
        <div className="shell section-intro compact-intro">
          <SectionLabel>Evidence to decision</SectionLabel>
          <h2>Probability is a governed method, not a promise.</h2>
          <p>When evidence is insufficient, Route IQ says so. Observational evidence does not prove causal uplift or recommendation superiority.</p>
        </div>
        <div className="shell lifecycle-grid">
          {lifecycle.map(([number, title, body], index) => (
            <motion.article
              key={number}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-55px" }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.42, delay: prefersReducedMotion ? 0 : index * 0.05 }}
            >
              <span>{number}</span><h3>{title}</h3><p>{body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="different" className="section difference-section">
        <div className="shell difference-layout">
          <div className="difference-heading">
            <SectionLabel>Why Route IQ</SectionLabel>
            <h2>The evidence layer between field activity and the next human decision.</h2>
            <p>Route IQ complements the systems a field organization already uses. Its differentiated job is governing the context those systems usually leave disconnected.</p>
          </div>
          <div className="comparison-table" role="table" aria-label="Route IQ product differentiation">
            {differences.map(([category, categoryPurpose, routeIqPurpose]) => (
              <div className="comparison-row" role="row" key={category}>
                <strong role="cell">{category}</strong>
                <span role="cell">{categoryPurpose}</span>
                <p role="cell">{routeIqPurpose}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section boundary-section">
        <div className="shell boundary-layout">
          <div>
            <SectionLabel>Current boundary</SectionLabel>
            <h2>Credibility starts with saying what is not proven.</h2>
          </div>
          <div className="boundary-list">
            <p><strong>Current readiness:</strong> insufficient evidence for recommendation readiness.</p>
            <p><strong>Operational influence:</strong> recommendation influence is off; Route IQ does not silently reorder, notify, or act.</p>
            <p><strong>Evidence collection:</strong> prospective collection is off and active cohorts are zero.</p>
            <p><strong>Market evidence:</strong> shared configuration is verified; performance across industries is not yet proven.</p>
          </div>
        </div>
      </section>

      <section className="section configuration-section">
        <div className="shell configuration-layout">
          <div className="configuration-copy">
            <SectionLabel>One governed product</SectionLabel>
            <h2>Configured for the operating model, not forked for each customer.</h2>
            <p>Route IQ uses shared workspace and operating-profile configuration for business identity, territories, users, roles, terminology, measures, retention, and intelligence eligibility.</p>
            <p>Configuration does not remove the need for governed setup, authorization, territory design, or evidence work. It creates a reusable foundation without pretending every industry is already validated.</p>
          </div>
          <dl className="configuration-list">
            <div><dt>Workspace</dt><dd>Business and data boundary</dd></div>
            <div><dt>Operating profile</dt><dd>Workflow, language, and goals</dd></div>
            <div><dt>Evidence policy</dt><dd>Retention, quality, and eligibility</dd></div>
            <div><dt>Access</dt><dd>Role and representative isolation</dd></div>
          </dl>
        </div>
      </section>

      <section id="request" className="section request-section">
        <div className="shell request-layout">
          <div className="request-copy">
            <SectionLabel>Request Route IQ</SectionLabel>
            <h2>Bring us the field problem you cannot see clearly today.</h2>
            <p>Tell Prometheus how your field organization operates, who uses it, and what decision context is missing.</p>
            <ol className="request-steps">
              <li><span>1</span><p><strong>Validate</strong> The server normalizes and checks the request.</p></li>
              <li><span>2</span><p><strong>Store</strong> Success is reported only after durable acceptance.</p></li>
              <li><span>3</span><p><strong>Receipt</strong> A unique receipt confirms the accepted request.</p></li>
              <li><span>4</span><p><strong>Review</strong> The Founder reviews the request and may follow up.</p></li>
            </ol>
          </div>
          <RouteIqRequestForm />
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div className="footer-brand"><LogoMark /><div><strong>Prometheus</strong><span>Company behind Route IQ</span></div></div>
          <div className="footer-links">
            <a href="#how-it-works">How it works</a>
            <a href="#request">Request Route IQ</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/data-deletion">Data deletion</a>
            <a href={`mailto:${contactEmail}`}>Contact</a>
            <a href={instagramUrl}>Instagram</a>
          </div>
          <p className="footer-note">Route IQ provides governed decision support for human review. It does not claim to outperform people or existing tools, and it does not make autonomous decisions.</p>
          <p className="footer-designation"><span>PROMETHEUS ROUTE IQ&trade;</span><span>U.S. PATENT PENDING</span></p>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
