(function pageBridge() {
  const eventName = document.currentScript?.dataset?.eventName || "suno-receipts-network-event";
  const sensitivePattern = /token|auth|cookie|secret|password|credential/i;

  function sanitize(value, depth) {
    if (depth > 3) return "[truncated]";
    if (!value) return value;
    if (typeof value === "string") return value.slice(0, 1800);
    if (Array.isArray(value)) return value.slice(0, 16).map(item => sanitize(item, depth + 1));
    if (typeof value === "object") {
      const output = {};
      for (const key of Object.keys(value).slice(0, 35)) {
        output[key] = sensitivePattern.test(key) ? "[redacted]" : sanitize(value[key], depth + 1);
      }
      return output;
    }
    return value;
  }

  function parseBody(body) {
    if (!body) return null;
    if (typeof body === "string") {
      try {
        return sanitize(JSON.parse(body), 0);
      } catch {
        return body.slice(0, 1800);
      }
    }
    if (body instanceof URLSearchParams) {
      return sanitize(Object.fromEntries(body.entries()), 0);
    }
    if (body instanceof FormData) {
      const data = {};
      for (const [key, value] of body.entries()) {
        data[key] = typeof value === "string" ? value : `[file:${value.name || "blob"}]`;
      }
      return sanitize(data, 0);
    }
    return Object.prototype.toString.call(body);
  }

  function emit(transport, url, method, body, status) {
    if (!String(url).includes("suno")) return;
    window.postMessage({
      source: eventName,
      event: {
        transport,
        url: String(url),
        method: method || "GET",
        status,
        body: parseBody(body),
        timestamp: new Date().toISOString()
      }
    }, window.location.origin);
  }

  const originalFetch = window.fetch;
  window.fetch = async function patchedFetch(input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    const method = init?.method || input?.method || "GET";
    const body = init?.body;
    emit("fetch", url, method, body, "pending");
    const response = await originalFetch.apply(this, arguments);
    emit("fetch", response.url || url, method, body, response.status);
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
    this.__srMeta = { method, url };
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function patchedSend(body) {
    const meta = this.__srMeta || {};
    emit("xhr", meta.url, meta.method, body, "pending");
    this.addEventListener("loadend", () => emit("xhr", meta.url, meta.method, body, this.status));
    return originalSend.apply(this, arguments);
  };
})();
