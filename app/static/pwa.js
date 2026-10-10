// chowkidar (service worker) ko register karo
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.log("SW failed", err));
  });
}

// internet jaane aur aane ka popup (toast function app.js se aata hai)
window.addEventListener("offline", () => toast("You are offline"));
window.addEventListener("online", () => toast("Back online"));