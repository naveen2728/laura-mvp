const statusOptions = ["todo", "in-progress", "in-review", "complete"];

const state = {
  apiKey: localStorage.getItem("laura_api_key") || localStorage.getItem("bridgemind_api_key") || "",
  projects: [],
  tasks: [],
  apiKeys: [],
  modelProviders: [],
  agents: [],
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
  refreshStudioButton: document.querySelector("#refreshStudioButton"),
  modelForm: document.querySelector("#modelForm"),
  modelNameInput: document.querySelector("#modelNameInput"),
  modelKindInput: document.querySelector("#modelKindInput"),
  modelBaseUrlInput: document.querySelector("#modelBaseUrlInput"),
  modelNameValueInput: document.querySelector("#modelNameValueInput"),
  modelApiKeyInput: document.querySelector("#modelApiKeyInput"),
  modelList: document.querySelector("#modelList"),
  agentForm: document.querySelector("#agentForm"),
  agentNameInput: document.querySelector("#agentNameInput"),
  agentRoleInput: document.querySelector("#agentRoleInput"),
  agentModelInput: document.querySelector("#agentModelInput"),
  agentPromptInput: document.querySelector("#agentPromptInput"),
  agentList: document.querySelector("#agentList"),
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

function renderModelProviders() {
  el.modelList.innerHTML = "";

  if (!state.modelProviders.length) {
    el.modelList.innerHTML = '<p class="hint">No model providers yet.</p>';
  }

  for (const provider of state.modelProviders) {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <h3>${escapeHtml(provider.name)}</h3>
        <span class="status-pill">${escapeHtml(provider.kind)}</span>
      </div>
      <p>Model: ${escapeHtml(provider.model_name)}</p>
      <p>Base URL: ${escapeHtml(provider.base_url || "Provider default")}</p>
      <p>Key: ${provider.api_key_prefix ? `${escapeHtml(provider.api_key_prefix)}...` : "Not stored"}</p>
      <div class="row"><button type="button" class="danger">Remove</button></div>
    `;
    item.querySelector("button").addEventListener("click", () => deleteModelProvider(provider.id));
    el.modelList.appendChild(item);
  }

  el.agentModelInput.innerHTML = '<option value="">No model selected</option>';
  for (const provider of state.modelProviders) {
    const option = document.createElement("option");
    option.value = String(provider.id);
    option.textContent = `${provider.name} (${provider.model_name})`;
    el.agentModelInput.appendChild(option);
  }
}

function renderAgents() {
  el.agentList.innerHTML = "";

  if (!state.agents.length) {
    el.agentList.innerHTML = '<p class="hint">No agents yet.</p>';
    return;
  }

  for (const agent of state.agents) {
    const provider = state.modelProviders.find((item) => item.id === agent.model_provider_id);
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <h3>${escapeHtml(agent.name)}</h3>
        <span class="status-pill">${escapeHtml(agent.role)}</span>
      </div>
      <p>Model: ${escapeHtml(provider ? provider.name : "No model selected")}</p>
      <p>${escapeHtml(agent.system_prompt || "No system prompt")}</p>
      <div class="row"><button type="button" class="danger">Remove</button></div>
    `;
    item.querySelector("button").addEventListener("click", () => deleteAgent(agent.id));
    el.agentList.appendChild(item);
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

async function loadStudio() {
  state.modelProviders = await api("/studio/models");
  state.agents = await api("/studio/agents");
  renderModelProviders();
  renderAgents();
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
    await loadStudio();
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

async function createModelProvider(event) {
  event.preventDefault();
  await api("/studio/models", {
    method: "POST",
    body: JSON.stringify({
      name: el.modelNameInput.value,
      kind: el.modelKindInput.value,
      base_url: el.modelBaseUrlInput.value || null,
      model_name: el.modelNameValueInput.value,
      api_key: el.modelApiKeyInput.value || null,
    }),
  });
  el.modelForm.reset();
  showToast("Model provider added");
  await loadStudio();
}

async function deleteModelProvider(providerId) {
  await api(`/studio/models/${providerId}`, { method: "DELETE" });
  showToast("Model provider removed");
  await loadStudio();
}

async function createAgent(event) {
  event.preventDefault();
  await api("/studio/agents", {
    method: "POST",
    body: JSON.stringify({
      name: el.agentNameInput.value,
      role: el.agentRoleInput.value,
      model_provider_id: el.agentModelInput.value ? Number(el.agentModelInput.value) : null,
      system_prompt: el.agentPromptInput.value || null,
    }),
  });
  el.agentForm.reset();
  el.agentRoleInput.value = "assistant";
  showToast("Agent created");
  await loadStudio();
}

async function deleteAgent(agentId) {
  await api(`/studio/agents/${agentId}`, { method: "DELETE" });
  showToast("Agent removed");
  await loadStudio();
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
el.refreshStudioButton.addEventListener("click", loadStudio);
el.projectForm.addEventListener("submit", createProject);
el.taskForm.addEventListener("submit", createTask);
el.modelForm.addEventListener("submit", createModelProvider);
el.agentForm.addEventListener("submit", createAgent);

refreshAll();
