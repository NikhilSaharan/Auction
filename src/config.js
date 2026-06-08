// REPLACE THIS URL with your live Render backend URL
// Example: export const BACKEND_URL = 'https://auction-backend-xyz.onrender.com';
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://auction-backend-1-e2xr.onrender.com';

export const API_BASE = `${BACKEND_URL}/api`;
export const HUB_URL = `${BACKEND_URL}/auctionHub`;
