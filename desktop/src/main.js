const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_BASE_URL = "https://web-production-57e37.up.railway.app";
const IGNORED_DIRS = new Set([".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "release"]);

let workspaceRoot = null;

function assertWorkspacePath(relativePath) {
  if (!workspaceRoot) throw new Error("No workspace folder selected");
  const target = path.resolve(workspaceRoot, relativePath || ".");
  const root = path.resolve(workspaceRoot);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Path is outside the selected workspace");
  }
  return target;
}

async function collectFiles(dir, baseDir, files = []) {
  if (files.length >= 500) return files;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= 500) break;
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, absolutePath).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) await collectFiles(absolutePath, baseDir, files);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

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

ipcMain.handle("laura:workspace:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open workspace",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths.length) return null;
  workspaceRoot = result.filePaths[0];
  const files = await collectFiles(workspaceRoot, workspaceRoot);
  return { root: workspaceRoot, files };
});

ipcMain.handle("laura:workspace:list", async () => {
  if (!workspaceRoot) return { root: null, files: [] };
  const files = await collectFiles(workspaceRoot, workspaceRoot);
  return { root: workspaceRoot, files };
});

ipcMain.handle("laura:workspace:read", async (_event, relativePath) => {
  const target = assertWorkspacePath(relativePath);
  const content = await fs.readFile(target, "utf8");
  return { path: relativePath, content };
});

ipcMain.handle("laura:workspace:write", async (_event, payload) => {
  const target = assertWorkspacePath(payload.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, payload.content ?? "", "utf8");
  const files = await collectFiles(workspaceRoot, workspaceRoot);
  return { path: payload.path, files };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
