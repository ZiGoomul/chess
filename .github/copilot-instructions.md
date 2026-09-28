# Project Guidance

- Use Context7 for current library documentation, API usage, and configuration questions; resolve the exact library ID before querying docs.
- Keep TypeScript migration incremental and run `npm run typecheck`, `npm test`, and `npm run build` after changes.
- Keep browser/UI dependencies out of domain and service modules; pass dependencies through typed APIs.