Known tech debt and deferred improvements to revisit.

- [ ] Replace build-time env placeholders in web Dockerfile with `force-dynamic` on the auth route so Next.js never evaluates `env.ts` at build
- [ ] Replace `SKIP_ENV_VALIDATION` workaround pattern in CI schema gen step with a cleaner solution (e.g. `t3-env` or lazy validation)
- [ ] Consider migrating `env.ts` to `@t3-oss/env-nextjs` for proper build/runtime env separation
- [ ] Navbar cursor (pointer) not reliably showing on gear icon and Upgrade button — attempted z-index: 1 on .navbar and moving cursor: pointer to .navbar-right svg, but issue persists; likely an invisible hit-test overlay from the editor area, needs browser devtools investigation
- [ ] **IMPORTANT** — Move `wsToken` out of `sessionStorage` and into an `HttpOnly` cookie. Currently the token is cached in `sessionStorage` (key `dumpbook_init`), which is readable by JavaScript and therefore vulnerable if XSS were ever introduced. Fix: have `/api/user/init` set the token as an `HttpOnly` cookie and configure the Hocuspocus provider to authenticate via cookie instead of the token prop.
