// Setup and Initialization for Courier Onboarding System
// Initialize Courier SDK and configure multi-tenant setup

import { CourierClient } from "@trycourier/courier";

// Initialize main Courier client
const courier = CourierClient({
  authorizationToken: process.env.COURIER_AUTH_TOKEN
});

// For multi-tenant setup, configure tenant-specific tokens
const tenantTokens = {
  enterprise: process.env.COURIER_ENTERPRISE_TOKEN,
  startup: process.env.COURIER_STARTUP_TOKEN,
  trial: process.env.COURIER_TRIAL_TOKEN
};

// Export configured clients
export { courier, tenantTokens };