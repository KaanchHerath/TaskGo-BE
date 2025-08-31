
# 🎬 TaskGo Frontend Walkthrough – Video Script

## [0:00 – 0:20] Intro & High-Level Overview
**🎙️ Say:**  
"Hi, in this video I’ll walk you through the TaskGo frontend codebase. TaskGo is a marketplace platform where customers can post tasks and taskers can apply, negotiate, and complete them.  

The frontend is built with React, Vite, and Tailwind. We follow a clean modular structure with routing, centralized API services, authentication helpers, and optional realtime features via Socket.IO. Let’s take a look."

**📹 Show on screen:**  
App running briefly → then show folder tree of `src/`.

```
src/
├── components/       # Reusable UI components
├── pages/            # Page-level components
├── services/api/     # API layer (Axios + services)
├── utils/            # Helpers (auth, routing guards)
├── config/           # Environment config
├── hooks/            # Custom React hooks
└── App.jsx           # Main routing + guards
```

**🎙️ Say:**  
"We keep the UI consistent and maintainable by composing pages from small, reusable pieces. Common building blocks live in `src/components/common` — like `Button`, `Input`, `Modal`, `EmptyState`, `LoadingSpinner`, and `Badge`. Layout elements are in `layout folder` (`Navbar`, `Footer`, `Layout`). Admin-focused widgets such as `ChartComponents` and `DocumentViewer` reside under `src/components/admin`.


**📹 Show on screen:**  
- `src/components/common/Button.jsx` and `Modal.jsx`  
- `src/components/layout/Navbar.jsx`

---

## [0:20 – 1:00] Routing & Guards
**🎙️ Say:**  
"Routing is defined in `App.jsx` using `react-router-dom`. We use a role-aware approach, wrapping private routes with `PrivateRoute`. This ensures only authenticated users with the right role can access certain pages.  

If the token is missing or invalid, users are redirected to login. If the role doesn’t match, they’re redirected to their role’s dashboard via `DashboardRedirect` (lines 62–87).  

For taskers, we add two additional checks: `GlobalApprovalGate` for global access restrictions and `TaskerApprovalCheck` for local tasker-only routes. Unapproved taskers are redirected to a waiting screen."

**📹 Show code:**  
- `src/App.jsx` → show `PrivateRoute` imports & setup (lines 59–61)  
- Highlight role-based routes (lines 94–160):  
  - Customer routes (lines 105–118)  
  - Tasker routes with `TaskerApprovalCheck` (lines 131–147)  
  - Admin routes (lines 150–159)  

---

## [1:00 – 1:30] Authentication Utilities
**🎙️ Say:**  
"Auth is centralized in `utils/auth.js`. We store JWT tokens in `localStorage`, parse them to extract role and claims, and expose helpers like `getToken`, `setToken`, and `clearToken`.  

When a token or display name changes, we fire a custom `authStateChanged` event. Components like the Navbar listen for this event to update immediately on login or logout (Navbar.jsx lines 51–69)."

**📹 Show code:**  
- `src/utils/auth.js`:  
  - `roleToDashboard` (lines 3–7)  
  - `parseJwt` (lines 9–15)  
  - `getToken` (lines 17–19)  
  - `setToken` (lines 21–25)  
  - `clearToken` (lines 46–52)  

---

## [1:30 – 2:00] Axios Setup & Request Flow
**🎙️ Say:**  
"All API requests are centralized through a single Axios instance in `axiosConfig.js`. The base URL comes from `APP_CONFIG.API.BASE_URL` in `appConfig.js`.  

The request interceptor attaches the JWT token automatically (lines 15–23). On the response side, we handle `401` errors by attempting a refresh. If the refresh succeeds, we retry the request. If not, we clear auth and redirect to login (lines 41–80). This keeps the user session seamless and secure."

**📹 Show code:**  
- `src/services/api/axiosConfig.js`: base URL setup (lines 5–13)

---

## [2:00 – 2:30] API Services
**🎙️ Say:**  
"To keep components clean, we wrap API calls in service modules. For example:  
- `taskService.js` handles task creation, listing, and updates.  
- `statsService.js` powers dashboard analytics.  
- `adminService.js` handles approving or rejecting taskers.  

This abstraction ensures pages remain lean and testable."

**📹 Show code:**  
- `src/services/api/taskService.js`: `getTasks` (lines 37–56), `createTask` (lines 101–109)  
- `src/services/api/statsService.js`: `getDashboardStats` (lines 3–12)  
- `src/services/api/adminService.js`: `approveTasker` (lines 70–73)  

---

## [2:30 – 2:50] Realtime Features
**🎙️ Say:**  
"Realtime functionality is provided by Socket.IO, implemented in `socketService.js`. We authenticate sockets by passing the JWT in the handshake.  

Listeners are registered for events like new chat messages, task updates, and payment confirmations — making the experience interactive and immediate."

**📹 Show code:**  
- `src/services/api/socketService.js`:  
  - Connection setup with auth (lines 36–43)  
  - Reconnection config (lines 44–49)  
  - Example listeners: `onTaskUpdate` (lines 157–170), `onChatMessage` (lines 172–185)  

---

## [2:50 – 3:10] Configuration & Environment
**🎙️ Say:**  
"Configuration lives in `config/appConfig.js`, where we define the API base URL, timeouts, and UI constants.  

For local dev, Vite proxies `/api` requests to the backend, and Tailwind is integrated for styling."

**📹 Show code:**  
- `src/config/appConfig.js`: API config (lines 4–10)  

---

## [3:10 – 3:30] Wrap Up
**🎙️ Say:**  
"So to wrap up: the TaskGo frontend uses a modular structure with role-based routing, centralized auth utilities, a robust Axios pipeline, clean API services, and optional realtime updates.  

With Vite and Tailwind, development stays fast, and the structure ensures maintainability, scalability, and a professional user experience."

**📹 Show:** Project folder tree again for recap.
