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

// fetch() has no reliable cross-browser way to report upload progress, so
// form uploads that want a progress callback go through XHR instead.
function requestFormWithProgress(method, path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${BASE}${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const contentType = xhr.getResponseHeader("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.error || `Request failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  postForm: (path, formData, onProgress) =>
    onProgress
      ? requestFormWithProgress("POST", path, formData, onProgress)
      : request(path, { method: "POST", body: formData, isFormData: true }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  patchForm: (path, formData, onProgress) =>
    onProgress
      ? requestFormWithProgress("PATCH", path, formData, onProgress)
      : request(path, { method: "PATCH", body: formData, isFormData: true }),
  del: (path) => request(path, { method: "DELETE" }),
};
