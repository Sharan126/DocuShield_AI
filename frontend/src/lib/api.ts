import { useAuthStore } from "@/store/authStore";

export const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "https://docushield-ai.onrender.com";
};

export async function checkBackendHealth(timeoutMs = 10000): Promise<{
  online: boolean;
  status?: string;
  message?: string;
  statusCode?: number;
}> {
  const apiUrl = getApiUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${apiUrl}/`, {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => ({ status: "online" }));
      return {
        online: true,
        status: data.status || "online",
        message: data.tagline || "Backend engine operational",
        statusCode: res.status
      };
    }
    return {
      online: false,
      message: `Backend returned status ${res.status}`,
      statusCode: res.status
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        online: false,
        message: "Connection timed out. Server may be spinning up from cold sleep."
      };
    }
    return {
      online: false,
      message: "Backend service unreachable. Verify network or deployment status."
    };
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const apiUrl = getApiUrl();
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      // Clear localStorage
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Clear cookie
      document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

      // Reset Zustand store state
      useAuthStore.getState().clearAuth();

      // Redirect to login page
      window.location.href = "/login";
    }
  }

  return response;
}
