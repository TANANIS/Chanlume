(function () {
  "use strict";
  // Keep YouTube's recommendations in their native source/order. An older
  // experimental "Featured for you" shelf had no missed-video evidence.
  globalThis.createChanlumeHome = ({ getState }) => {
    function clearFeatured() {
      document.getElementById("chanlume-home-featured")?.remove();
      document.querySelectorAll(".cl-home-featured-card").forEach(card => card.classList.remove("cl-home-featured-card"));
    }
    function clear() {
      clearFeatured();
      document.documentElement.classList.remove("chanlume-home-layout");
    }
    function render() {
      const settings = getState().settings;
      if (!settings.enabled || settings.blockHome || location.pathname !== "/") { clear(); return; }
      document.documentElement.classList.add("chanlume-home-layout");
      clearFeatured();
    }
    return { render, clear };
  };
})();
