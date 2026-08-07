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
    ["02", "Service corridor", "Available", "Verified open"],
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
            <div><span className="product-kicker">Representative workflow</span><h3 id="product-view-title">A focused field day</h3></div>
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
          <div className="product-intelligence-head"><span>Leader view</span><strong>Field visibility</strong></div>
          <div className="visibility-list" aria-label="Field activity context is organized for review">
            <p><span>Territory activity</span><b>Available for review</b></p>
            <p><span>Outcome context</span><b>Connected to visits</b></p>
            <p><span>Learning state</span><b>Evidence dependent</b></p>
          </div>
          <div className="boundary-note"><span>Human decision</span><p>Route IQ organizes context so a person can compare approved opportunities.</p></div>
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
    setStatus({ kind: "pending", message: "Validating your Prometheus Route IQ request...", receiptId: "" });
    try {
      const result = await submitRouteIqRequest({ payload: request.payload });
      setStatus({
        kind: "success",
        message: result.duplicate
          ? "Your existing Prometheus Route IQ request was found. The original receipt remains valid."
          : "Your Prometheus Route IQ request was accepted and stored for Founder review.",
        receiptId: result.receiptId
      });
      form.reset();
    } catch (error) {
      const messages = {
        REQUEST_RATE_LIMITED: "Too many requests were submitted. Please wait before trying again.",
        REQUEST_NETWORK_FAILED: "Prometheus.IQ could not confirm that your request was stored. Please try again later.",
        REQUEST_RECEIPT_MISSING: "Prometheus.IQ could not confirm a storage receipt. Please try again later.",
        REQUEST_RESPONSE_INVALID: "Prometheus.IQ returned an invalid confirmation. Please try again later."
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
        <span>I agree that Prometheus.IQ may use this information to respond to my Prometheus Route IQ request.</span>
      </label>
      <p id="request-privacy-note" className="request-note">Only the information needed to review and respond to this request is collected.</p>
      <p id="request-process-note" className="request-note">Success appears only after durable acceptance. You will receive a unique receipt; Prometheus.IQ then reviews the request and may follow up.</p>
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
  const intelligenceLoop = [
    ["01", "Observe", "Capture approved opportunity context, timing, field activity, and outcomes as the work happens."],
    ["02", "Connect", "Keep each action connected to the representative, territory, conditions, and result that shaped it."],
    ["03", "Learn", "When evidence quality and coverage support it, governed outcomes can contribute to authorized patterns over time."],
    ["04", "Support", "Make approved field context easier to compare while keeping the representative and leader in control."]
  ];

  const capabilities = [
    ["Opportunity focus", "Bring approved opportunities and the context needed to choose among them into one field workflow."],
    ["Timing and availability", "Help representatives avoid wasted stops by keeping operating windows and visit timing visible."],
    ["Territory awareness", "Connect field activity to the territory, account context, and local conditions surrounding it."],
    ["Representative context", "Keep representative-specific evidence isolated so authorized patterns can be evaluated over time when quality and coverage support them."],
    ["Fast outcome capture", "Record what happened while the visit is still fresh, with the context needed to learn from it later."],
    ["Leadership visibility", "Show field coverage, outcomes, and emerging patterns without turning the product into employee surveillance."]
  ];

  const differences = [
    ["CRM", "Records accounts, pipeline, and interactions.", "Route IQ complements the CRM by supporting the decision and action that happen between one field record and the next."],
    ["Lead list", "Presents names and contact details.", "Route IQ connects approved opportunities to territory, timing, availability, field activity, and outcomes."],
    ["Map", "Shows locations and navigation.", "Route IQ organizes context so a person can compare approved opportunities."],
    ["Distance-only routing", "Optimizes travel around proximity.", "Route IQ brings broader field context into the comparison without assuming the nearest stop should come first."],
    ["Generic AI advice", "Produces broad suggestions from a prompt.", "Route IQ works from governed business context and field evidence inside a defined operating workflow."],
    ["Surveillance", "Measures people primarily to watch them.", "Route IQ supports representatives and gives leaders operational insight without reducing field work to monitoring."]
  ];

  return (
    <main>
      <a className="skip-link" href="#how-it-works">Skip to how Route IQ works</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Prometheus Route IQ home">
          <LogoMark />
          <span className="brand-lockup"><strong>Prometheus.IQ</strong><small>Prometheus Route IQ</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#teams">For teams</a>
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
          <p className="patent-label">U.S. PATENT PENDING TECHNOLOGY</p>
          <SectionLabel>Prometheus.IQ Field Decision Intelligence</SectionLabel>
          <h1>Prometheus Route IQ</h1>
          <p className="hero-statement">Field decision intelligence for outside-sales teams.</p>
          <p className="hero-detail">Route IQ brings approved business context, territory, timing, availability, field activity, and governed outcome context together so outside-sales leaders and representatives can compare opportunities with better information.</p>
          <p className="hero-difference">More than businesses on a map, Route IQ supports the action between one CRM record and the next while keeping people in control.</p>
          <div className="hero-actions">
            <a className="button primary" href="#request">REQUEST ROUTE IQ</a>
            <a className="button secondary" href="#how-it-works">See How Route IQ Works</a>
          </div>
        </motion.div>
        <div className="hero-proof" aria-label="Route IQ customer value">
          <span><b>Representatives</b> get clearer field context</span>
          <span><b>Leaders</b> see execution patterns</span>
          <span><b>People</b> make the decision</span>
        </div>
      </section>

      <section id="how-it-works" className="section problem-section">
        <div className="shell problem-layout">
          <div>
            <SectionLabel>The operating problem</SectionLabel>
            <h2>The most important field decision often happens between systems.</h2>
          </div>
          <div className="problem-copy">
            <p>A CRM preserves account history. A map shows locations. A route planner can shorten the drive. The representative still has to compare approved opportunities and decide what to do next.</p>
            <p>Route IQ brings field context and outcomes together so representatives can act with better information and leaders can understand what execution is teaching the organization.</p>
          </div>
        </div>
      </section>

      <section id="teams" className="section product-section">
        <div className="shell section-intro">
          <SectionLabel>For the field team</SectionLabel>
          <h2>Support the representative in the moment. Help leadership improve the system around them.</h2>
          <p>Route IQ pairs a practical field workflow with a leadership view of coverage, outcomes, and patterns. Each role gets the context it needs without exposing protected intelligence or turning the workday into surveillance.</p>
        </div>
        <div className="shell support-grid">
          <article className="support-card">
            <span>For representatives</span>
            <h3>More context for the field decision.</h3>
            <p>Compare approved opportunities with relevant business context, timing, availability, and territory information in one place. Capture the result quickly, then keep moving.</p>
          </article>
          <article className="support-card">
            <span>For leadership</span>
            <h3>A clearer view of field execution.</h3>
            <p>Understand territory coverage, visit outcomes, changing conditions, and where the team may need stronger support, coaching, or operating context.</p>
          </article>
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

      <section className="section intelligence-loop-section">
        <div className="shell section-intro compact-intro">
          <SectionLabel>The intelligence loop</SectionLabel>
          <h2>Governed field outcomes can improve the context available over time.</h2>
          <p>Route IQ connects what the representative saw, what they did, and what happened next. When authorized evidence has sufficient quality and coverage, it can contribute to patterns that help the organization understand field execution.</p>
        </div>
        <div className="shell intelligence-loop-grid">
          {intelligenceLoop.map(([number, title, body], index) => (
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

      <section className="section capabilities-section">
        <div className="shell section-intro">
          <SectionLabel>Route IQ capabilities</SectionLabel>
          <h2>Built around the decisions that shape an outside-sales day.</h2>
          <p>Route IQ organizes the context surrounding field action without replacing the judgment of the people closest to the work.</p>
        </div>
        <div className="shell capability-grid">
          {capabilities.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="different" className="section difference-section">
        <div className="shell difference-layout">
          <div className="difference-heading">
            <SectionLabel>Why Route IQ</SectionLabel>
            <h2>Field action intelligence, not another place to store the same data.</h2>
            <p>Route IQ complements the systems an outside-sales organization already uses. Its job is to make the next field decision more informed and the resulting execution easier to understand.</p>
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

      <section id="industries" className="section configuration-section">
        <div className="shell configuration-layout">
          <div className="configuration-copy">
            <SectionLabel>Cross-industry configuration</SectionLabel>
            <h2>One Route IQ platform, configured for each field business.</h2>
            <p>Outside-sales organizations use different language, territories, opportunity types, workflows, outcomes, and success measures. Route IQ adapts those operating details through validated configuration instead of a separate product for every industry.</p>
            <p>The shared foundation keeps the experience consistent while each organization retains its own approved businesses, roles, territory rules, and field priorities.</p>
          </div>
          <dl className="configuration-list">
            <div><dt>Business language</dt><dd>Terminology that matches the team</dd></div>
            <div><dt>Territories</dt><dd>Approved opportunities and operating areas</dd></div>
            <div><dt>Field workflow</dt><dd>Roles, actions, and outcomes</dd></div>
            <div><dt>Success measures</dt><dd>Goals and performance context</dd></div>
          </dl>
        </div>
      </section>

      <section id="request" className="section request-section">
        <div className="shell request-layout">
          <div className="request-copy">
            <SectionLabel>Request Route IQ</SectionLabel>
            <h2>See what Route IQ could clarify for your field team.</h2>
            <p>Tell Prometheus.IQ how your outside-sales organization operates, where field decisions break down, and what representatives or leaders need to understand more clearly.</p>
            <ol className="request-steps">
              <li><span>1</span><p><strong>Share the field problem</strong> Describe the team, territory, and decision that needs better context.</p></li>
              <li><span>2</span><p><strong>Receive a receipt</strong> The request is confirmed only after durable acceptance.</p></li>
              <li><span>3</span><p><strong>Founder review</strong> Prometheus.IQ reviews the fit and may follow up about the next step.</p></li>
            </ol>
          </div>
          <RouteIqRequestForm />
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div className="footer-brand"><LogoMark /><div><strong>Prometheus.IQ</strong><span>Company behind Prometheus Route IQ</span></div></div>
          <div className="footer-links">
            <a href="#how-it-works">How it works</a>
            <a href="#request">Request Route IQ</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/data-deletion">Data deletion</a>
            <a href={`mailto:${contactEmail}`}>Contact</a>
            <a href={instagramUrl}>Instagram</a>
          </div>
          <p className="footer-note">Route IQ complements the CRM and mapping tools an outside-sales organization already uses. It brings field context, activity, and outcomes together to support better-informed human decisions.</p>
          <p className="footer-designation"><span>PROMETHEUS ROUTE IQ&trade;</span><span>U.S. PATENT PENDING</span></p>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
