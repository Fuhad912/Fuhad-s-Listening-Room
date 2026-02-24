(function () {
  "use strict";

  const body = document.body;
  if (!body) return;

  const pageClass = body.classList;
  const isLanding = pageClass.contains("landing-page");
  const isEnter = pageClass.contains("enter-page");
  const isDashboard = pageClass.contains("dashboard-page");

  function normalizePath(pathname) {
    const path = String(pathname || "/").replace(/\/+$/, "") || "/";
    return path === "/" ? "/index.html" : path;
  }

  function currentPath() {
    return normalizePath(window.location.pathname);
  }

  function hasTarget(id) {
    return Boolean(id && document.getElementById(id));
  }

  function sectionLink(label, id) {
    if (!hasTarget(id)) return null;
    return { label, href: `#${id}`, kind: "section" };
  }

  function pageLink(label, href) {
    return { label, href, kind: "page" };
  }

  function buildLinks() {
    const links = [];

    links.push(pageLink("Home", "/index.html"));

    if (isLanding) {
      const landingSections = [
        sectionLink("Studio Preview", "studio-preview"),
        sectionLink("What This Is", "what-room-heading"),
        sectionLink("Philosophy", "philosophy-heading"),
        sectionLink("Preset Showcase", "preset-showcase-heading"),
      ].filter(Boolean);

      links.push.apply(links, landingSections);
      links.push(pageLink("Enter Room", "/api/login"));
      links.push(pageLink("Dashboard", "/app.html"));
      return links;
    }

    links.push(pageLink("Enter Room", "/enter.html"));
    links.push(pageLink("Dashboard", "/app.html"));

    if (isEnter) {
      const enterSections = [
        sectionLink("Suggested Room", "enter-hero-heading"),
        sectionLink("Signature", "enter-signature-heading"),
        sectionLink("Last Session", "enter-last-session-heading"),
        sectionLink("Quick Presets", "enter-presets-heading"),
        sectionLink("Snapshot", "enter-snapshot-heading"),
      ].filter(Boolean);
      links.push.apply(links, enterSections);
    }

    if (isDashboard) {
      const dashboardSections = [
        sectionLink("Top Tracks", "top-tracks-heading"),
        sectionLink("Top Artists", "top-artists-heading"),
        sectionLink("Recently Played", "recent-heading"),
        sectionLink("Mood Generator", "mood-heading"),
        sectionLink("Time-of-day Rooms", "dayroom-heading"),
        sectionLink("Signature Playlist", "signature-heading"),
        sectionLink("Presets", "presets-heading"),
      ].filter(Boolean);
      links.push.apply(links, dashboardSections);
    }

    links.push(pageLink("Logout", "/api/logout"));
    return links;
  }

  function createToggleButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-nav-toggle";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "mobile-nav-drawer");
    button.setAttribute("aria-label", "Open navigation menu");
    button.innerHTML =
      '<span class="mobile-nav-toggle-lines" aria-hidden="true"><span></span><span></span><span></span></span>';
    return button;
  }

  function createBackdrop() {
    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "mobile-nav-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.tabIndex = -1;
    return backdrop;
  }

  function createDrawer() {
    const aside = document.createElement("aside");
    aside.id = "mobile-nav-drawer";
    aside.className = "mobile-nav-drawer";
    aside.setAttribute("aria-hidden", "true");
    aside.setAttribute("aria-label", "Mobile navigation");
    return aside;
  }

  function isActivePageHref(href) {
    if (!href || href.charAt(0) === "#") return false;
    try {
      const url = new URL(href, window.location.origin);
      return normalizePath(url.pathname) === currentPath();
    } catch (_error) {
      return false;
    }
  }

  const links = buildLinks();
  if (!links.length) return;

  const topbar = document.querySelector(".topbar");
  const toggle = createToggleButton();
  if (topbar) {
    topbar.classList.add("has-mobile-nav");
    toggle.classList.add("mobile-nav-toggle-inline");
    topbar.appendChild(toggle);
  } else {
    toggle.classList.add("mobile-nav-toggle-floating");
    body.appendChild(toggle);
  }

  const backdrop = createBackdrop();
  const drawer = createDrawer();

  const navList = links
    .map(function (item) {
      const activeClass = isActivePageHref(item.href) ? " is-active" : "";
      const typeClass = item.kind === "section" ? " is-section" : " is-page";
      return (
        '<li class="mobile-nav-item">' +
        '<a class="mobile-nav-link' +
        activeClass +
        typeClass +
        '" href="' +
        item.href +
        '">' +
        item.label +
        "</a>" +
        "</li>"
      );
    })
    .join("");

  drawer.innerHTML =
    '<div class="mobile-nav-header">' +
    '<div class="mobile-nav-title-wrap">' +
    '<p class="mobile-nav-kicker">Navigation</p>' +
    '<h2 class="mobile-nav-title">Fuhad Music Room</h2>' +
    "</div>" +
    '<button type="button" class="mobile-nav-close" aria-label="Close navigation">Close</button>' +
    "</div>" +
    '<nav class="mobile-nav-body" aria-label="Page navigation">' +
    '<ul class="mobile-nav-list">' +
    navList +
    "</ul>" +
    "</nav>";

  body.appendChild(backdrop);
  body.appendChild(drawer);

  const closeButton = drawer.querySelector(".mobile-nav-close");
  const firstLink = drawer.querySelector(".mobile-nav-link");
  let lastFocusedElement = null;

  function setOpen(open) {
    const isOpen = Boolean(open);
    if (isOpen) {
      lastFocusedElement = document.activeElement;
    }
    body.classList.toggle("is-mobile-nav-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
    backdrop.setAttribute("aria-hidden", isOpen ? "false" : "true");

    if (isOpen) {
      window.setTimeout(function () {
        if (firstLink) firstLink.focus();
      }, 20);
    } else if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      window.setTimeout(function () {
        lastFocusedElement.focus();
      }, 20);
    }
  }

  function toggleOpen() {
    setOpen(!body.classList.contains("is-mobile-nav-open"));
  }

  toggle.addEventListener("click", toggleOpen);
  backdrop.addEventListener("click", function () {
    setOpen(false);
  });
  if (closeButton) {
    closeButton.addEventListener("click", function () {
      setOpen(false);
    });
  }

  drawer.addEventListener("click", function (event) {
    const link = event.target.closest(".mobile-nav-link");
    if (!link) return;
    setOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && body.classList.contains("is-mobile-nav-open")) {
      setOpen(false);
    }
  });

  if (window.matchMedia) {
    const mql = window.matchMedia("(min-width: 769px)");
    const onMediaChange = function (event) {
      if (event.matches) {
        setOpen(false);
      }
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onMediaChange);
    } else if (typeof mql.addListener === "function") {
      mql.addListener(onMediaChange);
    }
  }
})();
