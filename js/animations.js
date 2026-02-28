(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  if (!window.gsap) {
    return;
  }

  const gsap = window.gsap;
  const topbar = document.querySelector(".topbar");
  const hero = document.querySelector(".hero-panel");
  const panels = Array.from(document.querySelectorAll(".panel")).filter((panel) => panel !== hero);

  if (topbar) {
    gsap.from(topbar, {
      y: -24,
      opacity: 0,
      duration: 0.65,
      ease: "power2.out",
    });
  }

  if (hero) {
    gsap.from(hero.children, {
      y: 24,
      opacity: 0,
      duration: 0.65,
      stagger: 0.08,
      delay: 0.08,
      ease: "power2.out",
    });
  }

  if (panels.length) {
    gsap.from(panels, {
      y: 24,
      opacity: 0,
      duration: 0.6,
      stagger: 0.06,
      delay: topbar ? 0.1 : 0,
      ease: "power2.out",
    });
  }

  const interactive = document.querySelectorAll(".btn, .tab");
  interactive.forEach((element) => {
    element.addEventListener("mouseenter", function () {
      gsap.to(element, { y: -1, duration: 0.18, ease: "power2.out", overwrite: "auto" });
    });
    element.addEventListener("mouseleave", function () {
      gsap.to(element, { y: 0, duration: 0.2, ease: "power2.out", overwrite: "auto" });
    });
  });
})();
