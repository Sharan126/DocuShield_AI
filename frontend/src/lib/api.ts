import { useAuthStore } from "@/store/authStore";

const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "https://docushield-ai.onrender.com";
};

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
