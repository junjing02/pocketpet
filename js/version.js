// Single source of truth for the version footer shown on both index.html and
// app.html (see .app-version). Bump deliberately on meaningful commits —
// patch (x.x.N) for fixes, minor (x.N.0) for new features, major (N.0.0) for
// a breaking data-model or full redesign — not on every commit, and not the
// same thing as the ?v=N cache-bust query string elsewhere in this file,
// which just forces a fresh fetch and has no semantic meaning.
export const VERSION = "1.13.0";
