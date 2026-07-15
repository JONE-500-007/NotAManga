const BASE = "/api";

async function request(path, { method = "GET", body, isFormData = false } = {}) {
  const options = { method, credentials: "include" };

  if (body !== undefined) {
    if (isFormData) {
      options.body = body;
    } else {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BASE}${path}`, options);
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  postForm: (path, formData) => request(path, { method: "POST", body: formData, isFormData: true }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  patchForm: (path, formData) => request(path, { method: "PATCH", body: formData, isFormData: true }),
  del: (path) => request(path, { method: "DELETE" }),
};
