(function () {
  "use strict";

  const body = document.body;
  if (!body) return;

  const isLanding = body.classList.contains("landing-page");
  const isEnter = body.classList.contains("enter-page");
  const isDashboard = body.classList.contains("dashboard-page");

  function normalizePath(pathname) {
    const cleaned = String(pathname || "/").replace(/\/+$/, "") || "/";
    return cleaned === "/" ? "/index.html" : cleaned;
  }

  function currentPath() {
    return normalizePath(window.location.pathname);
  }

  function sectionLink(label, id) {
    if (!id || !document.getElementById(id)) return null;
    return { label, href: `#${id}`, kind: "section" };
  }

  function pageLink(label, href) {
    return { label, href, kind: "page" };
  }

  function buildLinks() {
    const links = [pageLink("Home", "/index.html")];

    if (isLanding) {
      [sectionLink("Features", "home-features"), sectionLink("Get Started", "home-cta")]
        .filter(Boolean)
        .forEach((item) => links.push(item));
      links.push(pageLink("Enter Room", "/api/login"));
      links.push(pageLink("Analytics", "/app.html"));
      return links;
    }

    links.push(pageLink("Enter", "/enter.html"));
    links.push(pageLink("Analytics", "/app.html"));

    if (isEnter) {
      const snap = sectionLink("Snapshot", "enter-snapshot");
      if (snap) links.push(snap);
    }

    if (isDashboard) {
      [
        sectionLink("Summary", "analytics-summary-heading"),
        sectionLink("Charts", "analytics-charts"),
        sectionLink("Top Tracks", "list-top-tracks-heading"),
      ]
        .filter(Boolean)
        .forEach((item) => links.push(item));
    }

    links.push(pageLink("Logout", "/api/logout"));
    return links;
  }

  const links = buildLinks();
  if (!links.length) return;

  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mobile-nav-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "mobile-nav-drawer");
  toggle.setAttribute("aria-label", "Open navigation menu");
  toggle.innerHTML =
    '<span class="mobile-nav-toggle-lines" aria-hidden="true"><span></span><span></span><span></span></span>';
  topbar.appendChild(toggle);

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "mobile-nav-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.tabIndex = -1;

  const drawer = document.createElement("aside");
  drawer.id = "mobile-nav-drawer";
  drawer.className = "mobile-nav-drawer";
  drawer.setAttribute("aria-hidden", "true");
  drawer.setAttribute("aria-label", "Mobile navigation");

  const listHtml = links
    .map((item) => {
      let active = false;
      if (item.kind === "page") {
        try {
          const target = new URL(item.href, window.location.origin);
          active = normalizePath(target.pathname) === currentPath();
        } catch (_error) {
          active = false;
        }
      }
      return `<li class="mobile-nav-item"><a class="mobile-nav-link${
        item.kind === "section" ? " is-section" : ""
      }${active ? " is-active" : ""}" href="${item.href}">${item.label}</a></li>`;
    })
    .join("");

  drawer.innerHTML = `
    <div class="mobile-nav-header">
      <div>
        <p class="mobile-nav-kicker">Navigation</p>
        <h2 class="mobile-nav-title">Fuhad Music Room</h2>
      </div>
      <button type="button" class="mobile-nav-close" aria-label="Close navigation">Close</button>
    </div>
    <nav class="mobile-nav-body" aria-label="Page navigation">
      <ul class="mobile-nav-list">${listHtml}</ul>
    </nav>
  `;

  body.appendChild(backdrop);
  body.appendChild(drawer);

  const closeButton = drawer.querySelector(".mobile-nav-close");

  function setOpen(open) {
    const isOpen = Boolean(open);
    body.classList.toggle("is-mobile-nav-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
    backdrop.setAttribute("aria-hidden", isOpen ? "false" : "true");
  }

  toggle.addEventListener("click", function () {
    setOpen(!body.classList.contains("is-mobile-nav-open"));
  });

  backdrop.addEventListener("click", function () {
    setOpen(false);
  });

  if (closeButton) {
    closeButton.addEventListener("click", function () {
      setOpen(false);
    });
  }

  drawer.addEventListener("click", function (event) {
    const link = event.target.closest("a");
    if (link) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && body.classList.contains("is-mobile-nav-open")) {
      setOpen(false);
    }
  });
})();
