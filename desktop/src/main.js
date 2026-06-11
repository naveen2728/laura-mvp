const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");

const DEFAULT_BASE_URL = "https://web-production-57e37.up.railway.app";

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1120,
    minHeight: 720,
    title: "Laura Desktop",
    icon: path.join(__dirname, "assets", "icon.ico"),
    backgroundColor: "#0f1d1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.handle("laura:request", async (_event, request) => {
  const baseUrl = request.baseUrl || DEFAULT_BASE_URL;
  const url = new URL(request.path, baseUrl);
  const headers = {
    "Content-Type": "application/json",
    ...(request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {}),
    ...(request.headers || {})
  };

  const response = await fetch(url, {
    method: request.method || "GET",
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body)
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const detail = body && typeof body === "object" && body.detail ? body.detail : text;
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return body;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
