function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendError(res, error, fallbackStatusCode = 500, fallbackMessage = "Unexpected server error.") {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : fallbackStatusCode;
  const message = String(error?.message || fallbackMessage);
  sendJson(res, statusCode, { error: message });
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return req.body ? JSON.parse(req.body) : {};
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) {
    return true;
  }

  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { error: "Method not allowed." });
  return false;
}

module.exports = {
  allowMethods,
  readJson,
  sendError,
  sendJson
};

