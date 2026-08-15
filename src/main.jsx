import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import prometheusLogoUrl from "../icons/prometheus-company-icon-512.png";
import {
  buildRouteIqRequestPayload,
  resolveAcquisitionSource,
  submitRouteIqRequest
} from "./route-iq-request-form.js";
import {
  ROUTE_IQ_GYM_REQUEST_RECEIPT_PATTERN,
  buildRouteIqGymRequestPayload,
  buildRouteIqGymThankYouPath,
  collectRouteIqGymAttribution,
  preserveRouteIqGymAttribution,
  submitRouteIqGymRequest
} from "./route-iq-gym-request-form.js";
import "./styles.css";

const contactEmail = "prometheusrouteiq@gmail.com";
const instagramUrl = "https://www.instagram.com/prometheus.IQ";
const investorDeckEmail = `mailto:${contactEmail}?subject=Request%20Investor%20Deck`;
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

const routeMetadata = Object.freeze({
  gym: Object.freeze({
    title: "Prometheus Route IQ for Gyms | Field Sales Intelligence",
    description: "Prometheus Route IQ builds field-sales dashboards for U.S. small and independent warehouse-style gyms, with GPS-verified context and people in control.",
    canonical: "https://prometheusrouteiq.com/",
    image: "https://prometheusrouteiq.com/01-772904932_1493675372780221_5358616428807129112_n-2.jpeg",
    imageWidth: "2048",
    imageHeight: "1072",
    imageAlt: "Gym owners: 29 members in 48 hours. Zero ad spend."
  }),
  investors: Object.freeze({
    title: "Prometheus Route IQ | Investor Overview",
    description: "Prometheus Route IQ is field decision intelligence for outside-sales teams, connecting territory, timing, field activity, and governed outcomes.",
    canonical: "https://prometheusrouteiq.com/investors",
    image: "https://prometheusrouteiq.com/route-iq-field-operations-social.jpg",
    imageWidth: "1200",
    imageHeight: "675",
    imageAlt: "A synthetic field representative reviewing a Prometheus Route IQ field route in a commercial district"
  }),
  thankYou: Object.freeze({
    title: "Thank You | Prometheus Route IQ",
    description: "Prometheus Route IQ request receipt.",
    canonical: "https://prometheusrouteiq.com/thank-you",
    image: "https://prometheusrouteiq.com/01-772904932_1493675372780221_5358616428807129112_n-2.jpeg",
    imageWidth: "2048",
    imageHeight: "1072",
    imageAlt: "Prometheus Route IQ for gym owners"
  })
});

function setMeta(selector, attribute, value) {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

function applyRouteMetadata(pathname) {
  const isThankYou = pathname === "/thank-you" || pathname === "/thank-you/";
  const metadata = isThankYou
    ? routeMetadata.thankYou
    : pathname === "/investors" || pathname === "/investors/"
      ? routeMetadata.investors
      : routeMetadata.gym;

  document.title = metadata.title;
  setMeta('meta[name="description"]', "content", metadata.description);
  setMeta('meta[name="robots"]', "content", isThankYou ? "noindex,nofollow,noarchive" : "index,follow,max-image-preview:large");
  setMeta('link[rel="canonical"]', "href", metadata.canonical);
  setMeta('meta[property="og:title"]', "content", metadata.title);
  setMeta('meta[property="og:description"]', "content", metadata.description);
  setMeta('meta[property="og:url"]', "content", metadata.canonical);
  setMeta('meta[property="og:image"]', "content", metadata.image);
  setMeta('meta[property="og:image:width"]', "content", metadata.imageWidth);
  setMeta('meta[property="og:image:height"]', "content", metadata.imageHeight);
  setMeta('meta[property="og:image:alt"]', "content", metadata.imageAlt);
  setMeta('meta[name="twitter:title"]', "content", metadata.title);
  setMeta('meta[name="twitter:description"]', "content", metadata.description);
  setMeta('meta[name="twitter:image"]', "content", metadata.image);
  setMeta('meta[name="twitter:image:alt"]', "content", metadata.imageAlt);
}

const PUBLIC_ROUTE_CHANGE_EVENT = "routeiq:public-route-change";
const PUBLIC_REACT_PATHS = new Set(["/", "/investors", "/thank-you"]);

function normalizePublicPath(pathname) {
  if (pathname === "/landing.html") return "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname;
}

function resolvePublicReactRoute(href) {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return PUBLIC_REACT_PATHS.has(normalizePublicPath(url.pathname)) ? url : null;
}

function navigatePublicRoute(href, { replace = false } = {}) {
  const url = resolvePublicReactRoute(href);
  if (!url) return false;

  const nextLocation = `${url.pathname}${url.search}${url.hash}`;
  window.history[replace ? "replaceState" : "pushState"]({}, "", nextLocation);
  window.dispatchEvent(new Event(PUBLIC_ROUTE_CHANGE_EVENT));
  return true;
}

function InternalLink({ href, children, onClick, ...props }) {
  const resolvedHref = href.startsWith("/")
    ? preserveRouteIqGymAttribution(href, window.location.href)
    : href;
  const handleClick = (event) => {
    onClick?.(event);
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || props.target
      || props.download
    ) return;

    if (navigatePublicRoute(resolvedHref)) {
      event.preventDefault();
      event.currentTarget.closest("details")?.removeAttribute("open");
    }
  };
  return <a href={resolvedHref} onClick={handleClick} {...props}>{children}</a>;
}

function GlobalNav() {
  const links = [
    ["/#gym-form", "For Gym Owners"],
    ["/investors", "For Investors"],
    ["/investors#industries", "For Enterprise"]
  ];

  return (
    <header className="site-header">
      <InternalLink className="brand" href="/" aria-label="Prometheus Route IQ home">
        <span className="brand-wordmark"><strong>PROMETHEUS.IQ</strong><small>ROUTE IQ</small></span>
      </InternalLink>
      <nav aria-label="Primary navigation">
        {links.map(([href, label]) => <InternalLink href={href} key={href}>{label}</InternalLink>)}
        <InternalLink className="header-action" href="/#gym-form">Get Dashboard</InternalLink>
      </nav>
      <details className="mobile-nav">
        <summary aria-label="Open navigation menu">Menu</summary>
        <div className="mobile-nav-panel">
          {links.map(([href, label]) => <InternalLink href={href} key={href}>{label}</InternalLink>)}
          <InternalLink className="header-action" href="/#gym-form">Get Dashboard</InternalLink>
        </div>
      </details>
    </header>
  );
}

function GlobalFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <span className="brand-wordmark"><strong>PROMETHEUS.IQ</strong><small>ROUTE IQ</small></span>
          <span>Field decision intelligence for outside-sales teams.</span>
        </div>
        <div className="footer-links">
          <InternalLink href="/#gym-form">For Gym Owners</InternalLink>
          <InternalLink href="/investors">For Investors</InternalLink>
          <InternalLink href="/investors#industries">For Enterprise</InternalLink>
          <InternalLink href="/privacy">Privacy</InternalLink>
          <InternalLink href="/terms">Terms</InternalLink>
          <InternalLink href="/data-deletion">Data deletion</InternalLink>
          <a href={`mailto:${contactEmail}`}>Contact</a>
          <a href={instagramUrl}>Instagram</a>
        </div>
        <p className="footer-note">Route IQ complements the CRM and mapping tools an outside-sales organization already uses. It brings field context, activity, and outcomes together to support better-informed human decisions.</p>
        <p className="footer-designation"><span>PROMETHEUS ROUTE IQ&trade;</span><span>U.S. PATENT PENDING</span></p>
      </div>
    </footer>
  );
}

function DisabledMeasurementPlaceholders() {
  return (
    <div className="measurement-placeholders" aria-hidden="true">
      <div id="reddit-measurement-placeholder" data-provider="reddit" data-status="disabled" />
      <div id="meta-measurement-placeholder" data-provider="meta" data-status="disabled" />
    </div>
  );
}

function MobileGymCta() {
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const form = document.getElementById("gym-form");
    if (!form || typeof IntersectionObserver !== "function") return undefined;
    const observer = new IntersectionObserver(
      entries => setFormVisible(entries.some(entry => entry.isIntersecting)),
      { threshold: 0.02 }
    );
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  return (
    <InternalLink
      className={`mobile-fixed-cta${formVisible ? " is-hidden" : ""}`}
      href="/#gym-form"
      aria-hidden={formVisible ? "true" : undefined}
      tabIndex={formVisible ? -1 : undefined}
    >
      Get Dashboard
    </InternalLink>
  );
}

function GymRequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ kind: "idle", message: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const formData = Object.fromEntries(new FormData(form).entries());
    formData.consent = form.elements.consent.checked;
    const request = buildRouteIqGymRequestPayload({
      formData,
      attribution: collectRouteIqGymAttribution(window.location.href)
    });

    if (!request.ok) {
      setStatus({ kind: "error", message: request.errors.join(" ") });
      return;
    }

    setSubmitting(true);
    setStatus({ kind: "pending", message: "Submitting your Route IQ request..." });
    try {
      const result = await submitRouteIqGymRequest({ payload: request.payload });
      const thankYouPath = buildRouteIqGymThankYouPath(result.receiptId);
      if (!result.ok || !thankYouPath) throw new Error("REQUEST_RECEIPT_MISSING");
      if (!navigatePublicRoute(thankYouPath)) window.location.assign(thankYouPath);
    } catch (error) {
      const messages = {
        REQUEST_RATE_LIMITED: "Too many requests were submitted. Please wait before trying again.",
        REQUEST_NETWORK_FAILED: "We could not confirm your request. Please try again.",
        REQUEST_RECEIPT_MISSING: "We could not confirm a receipt. Your request was not shown as complete.",
        REQUEST_RESPONSE_INVALID: "We could not confirm your request. Please try again.",
        REQUEST_REJECTED: "Your request was not accepted. Please review the form and try again."
      };
      setStatus({
        kind: "error",
        message: messages[error?.message] || "We could not confirm your request. Please try again."
      });
      setSubmitting(false);
    }
  };

  return (
    <form id="gym-form" className="gym-request-form" onSubmit={handleSubmit} noValidate aria-labelledby="gym-form-title" aria-describedby="gym-request-note">
      <div className="gym-form-grid">
        <label>
          <span>Full Name</span>
          <input name="fullName" autoComplete="name" maxLength="120" required />
        </label>
        <label>
          <span>Gym Name</span>
          <input name="gymName" autoComplete="organization" maxLength="160" required />
        </label>
        <label>
          <span>City, State</span>
          <input name="cityState" autoComplete="address-level2" maxLength="160" placeholder="Houston, TX" required />
        </label>
        <label>
          <span>Number of Outside Reps</span>
          <select name="outsideRepCount" defaultValue="" required>
            <option value="" disabled>Select</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
          </select>
        </label>
        <label>
          <span>Work Email</span>
          <input name="workEmail" type="email" autoComplete="email" inputMode="email" maxLength="254" required />
        </label>
        <label>
          <span>Cell</span>
          <input name="cell" type="tel" autoComplete="tel" inputMode="tel" maxLength="24" required />
        </label>
      </div>
      <div className="gym-form-action-row">
        <label className="gym-consent-field">
          <input name="consent" type="checkbox" required />
          <span>I agree that Prometheus.IQ may use this information to respond to my Route IQ request.</span>
        </label>
        <button className="button primary gym-request-submit" type="submit" disabled={submitting}>
          {submitting ? "Building..." : "Build My Dashboard"}
        </button>
      </div>
      <label className="honeypot" aria-hidden="true">
        <span>Website</span>
        <input name="websiteUrl" tabIndex="-1" autoComplete="off" />
      </label>
      <p id="gym-request-note" className="gym-request-note">We manually build it. You'll get login + Loom walkthrough in ∼2 hours.</p>
      <div className={`gym-request-status ${status.kind}`} role="status" aria-live="polite" aria-atomic="true">
        {status.message}
      </div>
    </form>
  );
}

function GymPage() {
  return (
    <main className="gym-page">
      <a className="skip-link" href="#gym-form">Skip to the gym request form</a>
      <GlobalNav />
      <section id="top" className="gym-hero-section" aria-labelledby="gym-hero-heading">
        <h1 id="gym-hero-heading" className="visually-hidden">Gym Owners: 29 Members In 48 Hours. $0 Ad Spend.</h1>
        <picture className="gym-hero-picture">
          <source srcSet="/01-772904932_1493675372780221_5358616428807129112_n-2.webp" type="image/webp" />
          <img
            src="/01-772904932_1493675372780221_5358616428807129112_n-2.jpeg"
            alt="Gym owners: 29 members in 48 hours. Zero ad spend."
            width="2048"
            height="1072"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <div className="shell gym-request-band">
          <div className="gym-request-copy">
            <SectionLabel>Prometheus Route IQ for gyms</SectionLabel>
            <h2 id="gym-form-title">Get Your Gym's Route Dashboard Built In 2 Hours</h2>
            <div className="gym-hero-offer">
              <a className="button primary" href="#gym-form">Get My Gym Dashboard</a>
              <p>Dashboard built in 2 hours.</p>
            </div>
          </div>
          <GymRequestForm />
        </div>
      </section>

      <section id="intelligence" className="gym-intelligence-section">
        <div className="shell gym-intelligence-layout">
          <picture className="gym-intelligence-picture">
            <source srcSet="/02-prometheus_route_iq_ad.webp" type="image/webp" />
            <img
              src="/02-prometheus_route_iq_ad.jpg"
              alt="Other route apps give you a map. Prometheus gives you intelligence. GPS verified without surveillance."
              width="2240"
              height="1120"
              loading="lazy"
              decoding="async"
            />
          </picture>
          <div className="gym-intelligence-copy">
            <SectionLabel>Why Prometheus is different</SectionLabel>
            <h2>A field system built around what happens beyond the map.</h2>
            <div className="gym-intelligence-columns">
              <article>
                <h3>Know Where To Go</h3>
                <p>Use territory, timing, and field context to focus the next-stop plan.</p>
              </article>
              <article>
                <h3>Verify The Visit</h3>
                <strong>GPS Verified Without Surveillance</strong>
                <p>Confirm approved field visits while people stay in control.</p>
              </article>
              <article>
                <h3>Track The Outcome</h3>
                <p>Connect each visit to its result so owners can see what field activity produced.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="gym-bridge-section">
        <div className="shell gym-bridge-layout">
          <div className="gym-bridge-copy">
            <h2>The Bigger Vision: The Intelligence Layer For All Outside Sales</h2>
            <p>Gym sales is our first focused market.</p>
            <p>Horizontal infrastructure for home services, healthcare, commercial, retail, B2B.</p>
          </div>
          <InternalLink className="button secondary" href="/investors">EXPLORE THE FULL PLATFORM</InternalLink>
        </div>
      </section>
      <GlobalFooter />
      <MobileGymCta />
      <DisabledMeasurementPlaceholders />
    </main>
  );
}

function ThankYouPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const receipt = searchParams.getAll("receipt").length === 1 ? searchParams.get("receipt") || "" : "";
  const hasCanonicalReceipt = ROUTE_IQ_GYM_REQUEST_RECEIPT_PATTERN.test(receipt);

  return (
    <main className="thank-you-page">
      <GlobalNav />
      <section className="thank-you-section">
        <div className="shell thank-you-copy">
          {hasCanonicalReceipt ? (
            <>
              <SectionLabel>Route IQ request</SectionLabel>
              <h1>Got it. Building your dashboard now.</h1>
              <p>We're building your gym's custom route dashboard. You'll get email with login + Loom walkthrough in ∼2 hours from Prometheusrouteiq@gmail.com. Check spam.</p>
              <p className="thank-you-receipt">Receipt <strong>{receipt}</strong></p>
              <ol className="thank-you-steps">
                <li><strong>We build now</strong></li>
                <li><strong>You get login</strong></li>
                <li><strong>Reps get first route today</strong></li>
              </ol>
              <InternalLink className="button primary" href="/">Back to Home</InternalLink>
            </>
          ) : (
            <>
              <SectionLabel>Route IQ request</SectionLabel>
              <h1>Receipt unavailable.</h1>
              <p>This page does not confirm a request. Return to the gym request form and wait for a receipt before leaving.</p>
              <InternalLink className="button primary" href="/#gym-form">Return To Gym Form</InternalLink>
            </>
          )}
        </div>
      </section>
      <GlobalFooter />
      <DisabledMeasurementPlaceholders />
    </main>
  );
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

function InvestorPage() {
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
    <main className="investor-page">
      <a className="skip-link" href="#how-it-works">Skip to how Route IQ works</a>
      <div className="investor-top-line">
        <span>Built for private onboarding, executive review, and field operating discipline.</span>
        <a href={investorDeckEmail}>Request Investor Deck</a>
      </div>
      <GlobalNav />

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

      <section className="section investor-deck-section" aria-labelledby="investor-deck-title">
        <div className="shell investor-deck-layout">
          <div>
            <SectionLabel>Investor materials</SectionLabel>
            <h2 id="investor-deck-title">Review the Route IQ investor deck.</h2>
          </div>
          <a className="button primary" href={investorDeckEmail}>Request Investor Deck</a>
        </div>
      </section>

      <GlobalFooter />
      <DisabledMeasurementPlaceholders />
    </main>
  );
}

function PublicSiteRouter() {
  const [locationKey, setLocationKey] = useState(() => (
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  ));

  useEffect(() => {
    const updateLocation = () => {
      setLocationKey(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    };
    window.addEventListener("popstate", updateLocation);
    window.addEventListener(PUBLIC_ROUTE_CHANGE_EVENT, updateLocation);
    return () => {
      window.removeEventListener("popstate", updateLocation);
      window.removeEventListener(PUBLIC_ROUTE_CHANGE_EVENT, updateLocation);
    };
  }, []);

  const pathname = normalizePublicPath(window.location.pathname);
  useEffect(() => {
    applyRouteMetadata(pathname);
    window.requestAnimationFrame(() => {
      const hashTarget = window.location.hash
        ? document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
        : null;
      if (hashTarget) hashTarget.scrollIntoView({ block: "start" });
      else window.scrollTo({ top: 0, left: 0 });
    });
  }, [locationKey, pathname]);

  const Page = pathname === "/investors"
    ? InvestorPage
    : pathname === "/thank-you"
      ? ThankYouPage
      : GymPage;
  return <Page />;
}

createRoot(document.getElementById("root")).render(<PublicSiteRouter />);
