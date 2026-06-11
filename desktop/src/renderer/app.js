const DEFAULT_BASE_URL = "https://web-production-57e37.up.railway.app";
const statusOptions = ["todo", "in-progress", "in-review", "complete"];

const state = {
  baseUrl: localStorage.getItem("laura_desktop_base_url") || DEFAULT_BASE_URL,
  apiKey: localStorage.getItem("laura_desktop_api_key") || "",
  projects: [],
  tasks: [],
  models: [],
  agents: [],
  selectedProjectId: null
};

const $ = (selector) => document.querySelector(selector);

const el = {
  baseUrlInput: $("#baseUrlInput"),
  apiKeyInput: $("#apiKeyInput"),
  connectButton: $("#connectButton"),
  clearButton: $("#clearButton"),
  connectionStatus: $("#connectionStatus"),
  refreshButton: $("#refreshButton"),
  viewTitle: $("#viewTitle"),
  projectList: $("#projectList"),
  taskList: $("#taskList"),
  taskTitle: $("#taskTitle"),
  taskSubtitle: $("#taskSubtitle"),
  projectNameInput: $("#projectNameInput"),
  projectDescriptionInput: $("#projectDescriptionInput"),
  createProjectButton: $("#createProjectButton"),
  taskInstructionsInput: $("#taskInstructionsInput"),
  taskContextInput: $("#taskContextInput"),
  createTaskButton: $("#createTaskButton"),
  modelDisplayNameInput: $("#modelDisplayNameInput"),
  modelKindInput: $("#modelKindInput"),
  modelBaseUrlInput: $("#modelBaseUrlInput"),
  modelNameInput: $("#modelNameInput"),
  modelApiKeyInput: $("#modelApiKeyInput"),
  addModelButton: $("#addModelButton"),
  modelList: $("#modelList"),
  agentNameInput: $("#agentNameInput"),
  agentRoleInput: $("#agentRoleInput"),
  agentModelInput: $("#agentModelInput"),
  agentPromptInput: $("#agentPromptInput"),
  addAgentButton: $("#addAgentButton"),
  agentList: $("#agentList"),
  runProjectInput: $("#runProjectInput"),
  runAgentInput: $("#runAgentInput"),
  runPromptInput: $("#runPromptInput"),
  runAgentButton: $("#runAgentButton"),
  runOutput: $("#runOutput"),
  toast: $("#toast")
};

function request(path, options = {}) {
  return window.lauraDesktop.request({
    baseUrl: state.baseUrl,
    apiKey: state.apiKey,
    path,
    ...options
  });
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  setTimeout(() => el.toast.classList.remove("show"), 2400);
}

function connected(value) {
  el.connectionStatus.textContent = value ? "Connected" : "Disconnected";
  el.connectionStatus.classList.toggle("ok", value);
  el.connectionStatus.classList.toggle("bad", !value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshAll() {
  if (!state.apiKey) {
    connected(false);
    return;
  }

  try {
    const [projects, models, agents] = await Promise.all([
      request("/projects"),
      request("/studio/models"),
      request("/studio/agents")
    ]);
    state.projects = Array.isArray(projects) ? projects : [projects];
    state.models = models || [];
    state.agents = agents || [];
    if (!state.selectedProjectId && state.projects.length) {
      state.selectedProjectId = state.projects[0].id;
    }
    await loadTasks();
    render();
    connected(true);
  } catch (error) {
    connected(false);
    toast(error.message);
  }
}

async function loadTasks() {
  if (!state.selectedProjectId) {
    state.tasks = [];
    return;
  }
  state.tasks = await request(`/tasks?project_id=${state.selectedProjectId}`);
}

function render() {
  renderProjects();
  renderTasks();
  renderModels();
  renderAgents();
  renderRunOptions();
}

function renderProjects() {
  el.projectList.innerHTML = "";
  if (!state.projects.length) {
    el.projectList.innerHTML = '<p class="item">No projects yet.</p>';
    return;
  }
  for (const project of state.projects) {
    const item = document.createElement("article");
    item.className = `item ${project.id === state.selectedProjectId ? "active" : ""}`;
    item.innerHTML = `
      <div class="item-title">
        <h4>${escapeHtml(project.name)}</h4>
        <button class="secondary">Open</button>
      </div>
      <p>${escapeHtml(project.description || "No description")}</p>
    `;
    item.querySelector("button").addEventListener("click", async () => {
      state.selectedProjectId = project.id;
      await loadTasks();
      render();
    });
    el.projectList.appendChild(item);
  }
}

function renderTasks() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  el.taskTitle.textContent = project ? `Tasks: ${project.name}` : "Tasks";
  el.taskSubtitle.textContent = project ? "Shared memory for every connected model." : "Select a project.";
  el.taskList.innerHTML = "";
  if (!project) return;
  if (!state.tasks.length) {
    el.taskList.innerHTML = '<p class="item">No tasks yet.</p>';
    return;
  }
  for (const task of state.tasks) {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <h4>Task #${task.id}</h4>
        <span class="pill">${escapeHtml(task.status)}</span>
      </div>
      <p>${escapeHtml(task.instructions)}</p>
      <p>${escapeHtml(task.context || "")}</p>
      <div class="row">
        <select>${statusOptions.map((status) => `<option value="${status}" ${status === task.status ? "selected" : ""}>${status}</option>`).join("")}</select>
        <button class="secondary">Update</button>
      </div>
    `;
    const select = item.querySelector("select");
    item.querySelector("button").addEventListener("click", async () => {
      await request(`/tasks/${task.id}`, { method: "PATCH", body: { status: select.value } });
      await loadTasks();
      renderTasks();
    });
    el.taskList.appendChild(item);
  }
}

function renderModels() {
  el.modelList.innerHTML = "";
  if (!state.models.length) {
    el.modelList.innerHTML = '<p class="item">No models yet.</p>';
    return;
  }
  for (const model of state.models) {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <h4>${escapeHtml(model.name)}</h4>
        <span class="pill">${escapeHtml(model.kind)}</span>
      </div>
      <p>${escapeHtml(model.model_name)}</p>
      <p>${escapeHtml(model.base_url || "Provider default")}</p>
    `;
    el.modelList.appendChild(item);
  }
}

function renderAgents() {
  el.agentList.innerHTML = "";
  el.agentModelInput.innerHTML = '<option value="">No model selected</option>';
  for (const model of state.models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = `${model.name} (${model.model_name})`;
    el.agentModelInput.appendChild(option);
  }

  if (!state.agents.length) {
    el.agentList.innerHTML = '<p class="item">No agents yet.</p>';
    return;
  }
  for (const agent of state.agents) {
    const model = state.models.find((item) => item.id === agent.model_provider_id);
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <h4>${escapeHtml(agent.name)}</h4>
        <span class="pill">${escapeHtml(agent.role)}</span>
      </div>
      <p>Model: ${escapeHtml(model ? model.name : "None")}</p>
      <p>${escapeHtml(agent.system_prompt || "")}</p>
    `;
    el.agentList.appendChild(item);
  }
}

function renderRunOptions() {
  el.runProjectInput.innerHTML = "";
  for (const project of state.projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    el.runProjectInput.appendChild(option);
  }
  if (state.selectedProjectId) el.runProjectInput.value = state.selectedProjectId;

  el.runAgentInput.innerHTML = "";
  for (const agent of state.agents) {
    const option = document.createElement("option");
    option.value = agent.id;
    option.textContent = `${agent.name} (${agent.role})`;
    el.runAgentInput.appendChild(option);
  }
}

async function createProject() {
  await request("/projects", {
    method: "POST",
    body: {
      name: el.projectNameInput.value,
      description: el.projectDescriptionInput.value || null
    }
  });
  el.projectNameInput.value = "";
  el.projectDescriptionInput.value = "";
  toast("Project created");
  await refreshAll();
}

async function createTask() {
  if (!state.selectedProjectId) return toast("Select a project first");
  await request("/tasks", {
    method: "POST",
    body: {
      project_id: state.selectedProjectId,
      instructions: el.taskInstructionsInput.value,
      context: el.taskContextInput.value || null
    }
  });
  el.taskInstructionsInput.value = "";
  el.taskContextInput.value = "";
  toast("Task added");
  await refreshAll();
}

async function addModel() {
  await request("/studio/models", {
    method: "POST",
    body: {
      name: el.modelDisplayNameInput.value,
      kind: el.modelKindInput.value,
      base_url: el.modelBaseUrlInput.value || null,
      model_name: el.modelNameInput.value,
      api_key: el.modelApiKeyInput.value || null
    }
  });
  el.modelApiKeyInput.value = "";
  toast("Model added");
  await refreshAll();
}

async function addAgent() {
  await request("/studio/agents", {
    method: "POST",
    body: {
      name: el.agentNameInput.value,
      role: el.agentRoleInput.value || "assistant",
      model_provider_id: el.agentModelInput.value ? Number(el.agentModelInput.value) : null,
      system_prompt: el.agentPromptInput.value || null
    }
  });
  toast("Agent created");
  await refreshAll();
}

async function runAgent() {
  el.runOutput.textContent = "Running...";
  const result = await request("/studio/runs", {
    method: "POST",
    body: {
      project_id: Number(el.runProjectInput.value),
      agent_id: Number(el.runAgentInput.value),
      prompt: el.runPromptInput.value
    }
  });
  el.runOutput.textContent = [
    `${result.agent_name} using ${result.model_name}`,
    "",
    result.output,
    "",
    "--- Laura memory used ---",
    result.memory_context
  ].join("\n");
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.view}View`).classList.add("active");
    el.viewTitle.textContent = button.textContent;
  });
});

el.baseUrlInput.value = state.baseUrl;
el.apiKeyInput.value = state.apiKey;
el.connectButton.addEventListener("click", async () => {
  state.baseUrl = el.baseUrlInput.value.trim() || DEFAULT_BASE_URL;
  state.apiKey = el.apiKeyInput.value.trim();
  localStorage.setItem("laura_desktop_base_url", state.baseUrl);
  localStorage.setItem("laura_desktop_api_key", state.apiKey);
  await refreshAll();
});
el.clearButton.addEventListener("click", () => {
  localStorage.removeItem("laura_desktop_api_key");
  state.apiKey = "";
  el.apiKeyInput.value = "";
  connected(false);
});
el.refreshButton.addEventListener("click", refreshAll);
el.createProjectButton.addEventListener("click", () => createProject().catch((error) => toast(error.message)));
el.createTaskButton.addEventListener("click", () => createTask().catch((error) => toast(error.message)));
el.addModelButton.addEventListener("click", () => addModel().catch((error) => toast(error.message)));
el.addAgentButton.addEventListener("click", () => addAgent().catch((error) => toast(error.message)));
el.runAgentButton.addEventListener("click", () => runAgent().catch((error) => {
  el.runOutput.textContent = error.message;
  toast("Run failed");
}));

refreshAll();
