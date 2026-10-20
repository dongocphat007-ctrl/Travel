// PATCH: Override navigate() để render home section
(function(){
  let _origNav = window.navigate;
  window.navigate = function(page, opts){
    if (typeof _origNav === "function") _origNav(page, opts);
    if (page === "home" && window._initHomeSection) {
      setTimeout(window._initHomeSection, 50);
    }
  };
  // Also patch nav-home to go to page-home showing the hero
  let navHome = document.getElementById("nav-home");
  if (navHome) {
    var _origClick = navHome.onclick;
    navHome.addEventListener("click", function(){
      if (window._initHomeSection) setTimeout(window._initHomeSection, 80);
    });
  }
})();

// Initial render of home section
setTimeout(function(){
  if (window._initHomeSection) window._initHomeSection();
}, 300);
