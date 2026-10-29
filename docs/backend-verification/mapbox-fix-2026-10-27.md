# Mapbox configuration fix — 27 October 2026

Root cause: the existing public pk. token was saved only in admin-web/.env.example. Vite does not load example files, and no active frontend environment file existed.

Moved the existing token to ignored admin-web/.env.local, preserved VITE_API_URL=/api, and cleared the token value in the tracked example. No token was printed, no private Supabase credential was copied into the frontend, and no Mapbox account, token restrictions, billing or plan settings were changed. Vite automatically restarted and its served application module included the configured public token.

Verification:

- Focused map tests: 2 passed, 0 failed, 0 skipped.
- Live Chrome map view: 12 loaded raster tiles, all 12 provider responses HTTP 200.
- Browser referrer: http://127.0.0.1:5173/.
- Mapbox attribution visible; unavailable-state message absent; no browser runtime errors.
- Production build passed with the existing large-bundle warning.
- Active frontend environment file is ignored by Git.

See mapbox-configured-results.json and mapbox-configured.png. This verifies the existing static-tile map from the local origin, not geocoding, routing, production-domain restrictions, billing configuration, or authorized-marker rendering with live reports (the report dataset is empty).

Refresh the admin page. For future token changes, edit admin-web/.env.local and restart npm --prefix admin-web run dev; rebuild production assets after changing frontend environment values. Keep the public token restricted to the origins you use in the Mapbox dashboard.
