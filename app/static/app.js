const statusOptions = ["todo", "in-progress", "in-review", "complete"];

const state = {
  apiKey: localStorage.getItem("laura_api_key") || localStorage.getItem("bridgemind_api_key") || "",
  projects: [],
  tasks: [],
  apiKeys: [],
  selectedProjectId: null,
};

const el = {
  apiKeyInput: document.querySelector("#apiKeyInput"),
  saveKeyButton: document.querySelector("#saveKeyButton"),
  clearKeyButton: document.querySelector("#clearKeyButton"),
  connectionStatus: document.querySelector("#connectionStatus"),
  projectForm: document.querySelector("#projectForm"),
  projectNameInput: document.querySelector("#projectNameInput"),
  projectDescriptionInput: document.querySelector("#projectDescriptionInput"),
  projectList: document.querySelector("#projectList"),
  taskForm: document.querySelector("#taskForm"),
  taskInstructionsInput: document.querySelector("#taskInstructionsInput"),
  taskContextInput: document.querySelector("#taskContextInput"),
  taskList: document.querySelector("#taskList"),
  selectedProjectTitle: document.querySelector("#selectedProjectTitle"),
  selectedProjectSubtitle: document.querySelector("#selectedProjectSubtitle"),
  refreshProjectsButton: document.querySelector("#refreshProjectsButton"),
  refreshTasksButton: document.querySelector("#refreshTasksButton"),
  refreshKeysButton: document.querySelector("#refreshKeysButton"),
  apiKeyList: document.querySelector("#apiKeyList"),
  toast: document.querySelector("#toast"),
};

function authHeaders() {
  return state.apiKey ? { Authorization: `Bearer ${state.apiKey}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  window.setTimeout(() => el.toast.classList.remove("show"), 2600);
}

function setConnected(connected) {
  el.connectionStatus.textContent = connected ? "Connected" : "Not connected";
  el.connectionStatus.classList.toggle("ok", connected);
  el.connectionStatus.classList.toggle("bad", !connected);
}

function renderProjects() {
  el.projectList.innerHTML = "";

  if (!state.projects.length) {
    el.projectList.innerHTML = '<p class="hint">No projects yet.</p>';
    return;
  }

  for (const project of state.projects) {
    const item = document.createElement("article");
    item.className = `item ${project.id === state.selectedProjectId ? "active" : ""}`;
    item.innerHTML = `
      <div class="item-title">
        <h3>${escapeHtml(project.name)}</h3>
        <button type="button" class="secondary" data-project-id="${project.id}">Open</button>
      </div>
      <p>${escapeHtml(project.description || "No description")}</p>
    `;
    item.querySelector("button").addEventListener("click", () => selectProject(project.id));
    el.projectList.appendChild(item);
  }
}

function renderTasks() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  el.selectedProjectTitle.textContent = project ? `Tasks: ${project.name}` : "Tasks";
  el.selectedProjectSubtitle.textContent = project
    ? "Shared instructions and working context available to MCP clients."
    : "Select a project to view its task context.";
  el.taskForm.style.display = project ? "grid" : "none";
  el.taskList.innerHTML = "";

  if (!project) {
    el.taskList.innerHTML = '<p class="hint">No project selected.</p>';
    return;
  }

  if (!state.tasks.length) {
    el.taskList.innerHTML = '<p class="hint">No tasks in this project yet.</p>';
    return;
  }

  for (const task of state.tasks) {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <h3>Task #${task.id}</h3>
        <span class="status-pill">${task.status}</span>
      </div>
      <p><strong>Instructions:</strong> ${escapeHtml(task.instructions)}</p>
      <p><strong>Context:</strong> ${escapeHtml(task.context || "No context")}</p>
      <div class="task-actions">
        <select aria-label="Status for task ${task.id}">
          ${statusOptions.map((status) => `<option value="${status}" ${status === task.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <button type="button" class="secondary">Update</button>
      </div>
    `;
    const select = item.querySelector("select");
    item.querySelector("button").addEventListener("click", () => updateTaskStatus(task.id, select.value));
    el.taskList.appendChild(item);
  }
}

function renderApiKeys() {
  el.apiKeyList.innerHTML = "";

  if (!state.apiKeys.length) {
    el.apiKeyList.innerHTML = '<p class="hint">No key metadata loaded.</p>';
    return;
  }

  for (const key of state.apiKeys) {
    const item = document.createElement("article");
    const revoked = Boolean(key.revoked_at);
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <h3>${escapeHtml(key.name)}</h3>
        <span class="status-pill ${revoked ? "bad" : "ok"}">${revoked ? "Revoked" : "Active"}</span>
      </div>
      <p>Prefix: ${escapeHtml(key.prefix)}</p>
      <p>Last used: ${key.last_used_at ? escapeHtml(key.last_used_at) : "Never"}</p>
      ${revoked ? "" : '<div class="row"><button type="button" class="danger">Revoke</button></div>'}
    `;
    const revokeButton = item.querySelector("button");
    if (revokeButton) {
      revokeButton.addEventListener("click", () => revokeApiKey(key.id));
    }
    el.apiKeyList.appendChild(item);
  }
}

async function loadProjects() {
  state.projects = await api("/projects");
  if (!state.selectedProjectId && state.projects.length) {
    state.selectedProjectId = state.projects[0].id;
  }
  renderProjects();
  await loadTasks();
}

async function loadTasks() {
  if (!state.selectedProjectId) {
    state.tasks = [];
    renderTasks();
    return;
  }
  state.tasks = await api(`/tasks?project_id=${state.selectedProjectId}`);
  renderTasks();
}

async function loadApiKeys() {
  state.apiKeys = await api("/api-keys");
  renderApiKeys();
}

async function refreshAll() {
  if (!state.apiKey) {
    setConnected(false);
    renderProjects();
    renderTasks();
    renderApiKeys();
    return;
  }

  try {
    await loadProjects();
    await loadApiKeys();
    setConnected(true);
  } catch (error) {
    setConnected(false);
    showToast(error.message);
  }
}

async function selectProject(projectId) {
  state.selectedProjectId = projectId;
  renderProjects();
  await loadTasks();
}

async function createProject(event) {
  event.preventDefault();
  await api("/projects", {
    method: "POST",
    body: JSON.stringify({
      name: el.projectNameInput.value,
      description: el.projectDescriptionInput.value || null,
    }),
  });
  el.projectForm.reset();
  showToast("Project created");
  await loadProjects();
}

async function createTask(event) {
  event.preventDefault();
  if (!state.selectedProjectId) return;

  await api("/tasks", {
    method: "POST",
    body: JSON.stringify({
      project_id: state.selectedProjectId,
      instructions: el.taskInstructionsInput.value,
      context: el.taskContextInput.value || null,
    }),
  });
  el.taskForm.reset();
  showToast("Task created");
  await loadTasks();
}

async function updateTaskStatus(taskId, status) {
  await api(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  showToast("Task status updated");
  await loadTasks();
}

async function revokeApiKey(keyId) {
  await api(`/api-keys/${keyId}`, { method: "DELETE" });
  showToast("API key revoked");
  await loadApiKeys();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

el.apiKeyInput.value = state.apiKey;
el.saveKeyButton.addEventListener("click", async () => {
  state.apiKey = el.apiKeyInput.value.trim();
  localStorage.setItem("laura_api_key", state.apiKey);
  await refreshAll();
});
el.clearKeyButton.addEventListener("click", () => {
  state.apiKey = "";
  localStorage.removeItem("bridgemind_api_key");
  localStorage.removeItem("laura_api_key");
  el.apiKeyInput.value = "";
  setConnected(false);
  showToast("API key cleared");
});
el.refreshProjectsButton.addEventListener("click", loadProjects);
el.refreshTasksButton.addEventListener("click", loadTasks);
el.refreshKeysButton.addEventListener("click", loadApiKeys);
el.projectForm.addEventListener("submit", createProject);
el.taskForm.addEventListener("submit", createTask);

refreshAll();
