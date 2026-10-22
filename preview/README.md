# Working interactive preview

Open `Open-PATAG.html` directly in Chrome or Edge. Choose Citizen, LGU / Admin, or Maintenance. Use Switch role to move between them. No localhost server is needed. Actions persist in this browser; Citizen → Profile → Settings offers Reset preview data.

This is a runnable application with menus, filters, reports, forms and the full demo reporting/repair workflow. Admin and maintenance bundle the actual React source. Citizen is the separately approved browser demonstration of the native Flutter app. Fictional data and uploads remain in browser storage. Map backgrounds require internet; native camera/GPS and authentication need the actual Flutter app/API.

Rebuild from the repository root with `npm run build:preview` after installing both web app dependencies. Source lives in browser-preview/; the build script adapts routing and installs the demo API only for this artifact.
