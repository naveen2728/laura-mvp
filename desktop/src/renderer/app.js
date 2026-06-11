const DEFAULT_BASE_URL = "https://web-production-57e37.up.railway.app";
const statusOptions = ["todo", "in-progress", "in-review", "complete"];
const legacyMessages = JSON.parse(localStorage.getItem("laura_desktop_messages") || "[]");
const providerPresets = {
  openrouter: {
    name: "OpenRouter",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "moonshotai/kimi-k2"
  },
  openai: {
    name: "OpenAI",
    kind: "openai",
    baseUrl: "",
    model: "gpt-4.1"
  },
  anthropic: {
    name: "Anthropic",
    kind: "anthropic",
    baseUrl: "",
    model: "claude-sonnet-4-20250514"
  },
  ollama: {
    name: "Ollama",
    kind: "openai-compatible",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1"
  }
};

const state = {
  baseUrl: localStorage.getItem("laura_desktop_base_url") || DEFAULT_BASE_URL,
  apiKey: localStorage.getItem("laura_desktop_api_key") || "",
  projects: [],
  tasks: [],
  models: [],
  agents: [],
  selectedProjectId: null,
  selectedThreadId: localStorage.getItem("laura_desktop_selected_thread") || null,
  threads: JSON.parse(localStorage.getItem("laura_desktop_threads") || "[]"),
  lastMemory: ""
};

if (!state.threads.length) {
  state.threads = [
    {
      id: `thread_${Date.now()}`,
      title: legacyMessages.length ? "Imported thread" : "New thread",
      projectId: null,
      messages: legacyMessages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  state.selectedThreadId = state.threads[0].id;
}

const $ = (selector) => document.querySelector(selector);

const el = {
  baseUrlInput: $("#baseUrlInput"),
  apiKeyInput: $("#apiKeyInput"),
  connectButton: $("#connectButton"),
  clearButton: $("#clearButton"),
  connectionStatus: $("#connectionStatus"),
  openSettingsButton: $("#openSettingsButton"),
  closeSettingsButton: $("#closeSettingsButton"),
  settingsOverlay: $("#settingsOverlay"),
  configurationSummary: $("#configurationSummary"),
  setupButton: $("#setupButton"),
  setupOverlay: $("#setupOverlay"),
  setupCloseButton: $("#setupCloseButton"),
  setupSaveButton: $("#setupSaveButton"),
  setupBaseUrlInput: $("#setupBaseUrlInput"),
  setupApiKeyInput: $("#setupApiKeyInput"),
  setupProviderKeyInput: $("#setupProviderKeyInput"),
  setupModelNameInput: $("#setupModelNameInput"),
  setupAgentPromptInput: $("#setupAgentPromptInput"),
  refreshButton: $("#refreshButton"),
  newThreadButton: $("#newThreadButton"),
  threadList: $("#threadList"),
  projectList: $("#projectList"),
  taskList: $("#taskList"),
  taskTitle: $("#taskTitle"),
  threadTitle: $("#threadTitle"),
  renameThreadButton: $("#renameThreadButton"),
  clearThreadButton: $("#clearThreadButton"),
  deleteThreadButton: $("#deleteThreadButton"),
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
  composerInput: $("#composerInput"),
  runAgentButton: $("#runAgentButton"),
  messageList: $("#messageList"),
  memoryPreview: $("#memoryPreview"),
  toast: $("#toast")
};

let selectedProvider = "openrouter";

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
  setTimeout(() => el.toast.classList.remove("show"), 2600);
}

function connected(value) {
  el.connectionStatus.textContent = value ? "Online" : "Offline";
  el.connectionStatus.classList.toggle("ok", value);
  el.connectionStatus.classList.toggle("bad", !value);
}

function selectedPreset() {
  return providerPresets[selectedProvider];
}

function fillProviderPreset(provider) {
  selectedProvider = provider;
  const preset = selectedPreset();
  document.querySelectorAll(".provider-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.provider === provider);
  });
  el.setupModelNameInput.value = preset.model;
  el.modelDisplayNameInput.value = preset.name;
  el.modelKindInput.value = preset.kind;
  el.modelBaseUrlInput.value = preset.baseUrl;
  el.modelNameInput.value = preset.model;
}

function openSetup() {
  el.setupBaseUrlInput.value = state.baseUrl;
  el.setupApiKeyInput.value = state.apiKey;
  el.setupProviderKeyInput.value = "";
  el.setupAgentPromptInput.value = "You are Laura's coding agent. Use project memory, tasks, and constraints to help plan, build, debug, and explain software work.";
  fillProviderPreset(selectedProvider);
  el.setupOverlay.classList.remove("hidden");
}

function closeSetup() {
  el.setupOverlay.classList.add("hidden");
}

function openSettings() {
  el.settingsOverlay.classList.remove("hidden");
}

function closeSettings() {
  el.settingsOverlay.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveThreads() {
  localStorage.setItem("laura_desktop_threads", JSON.stringify(state.threads));
  localStorage.setItem("laura_desktop_selected_thread", state.selectedThreadId || "");
}

function currentThread() {
  let thread = state.threads.find((item) => item.id === state.selectedThreadId);
  if (!thread) {
    thread = createThread(false);
  }
  return thread;
}

function createThread(shouldRender = true) {
  const thread = {
    id: `thread_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    title: "New thread",
    projectId: state.selectedProjectId || null,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.threads.unshift(thread);
  state.selectedThreadId = thread.id;
  saveThreads();
  if (shouldRender) render();
  return thread;
}

function renameCurrentThread() {
  const thread = currentThread();
  const title = window.prompt("Thread name", thread.title || "New thread");
  if (!title) return;
  thread.title = title.trim().slice(0, 80) || "New thread";
  thread.updatedAt = new Date().toISOString();
  saveThreads();
  render();
}

function clearCurrentThread() {
  const thread = currentThread();
  if (thread.messages.length && !window.confirm("Clear all messages in this thread?")) return;
  thread.messages = [];
  thread.updatedAt = new Date().toISOString();
  saveThreads();
  render();
}

function deleteCurrentThread() {
  const thread = currentThread();
  if (!window.confirm(`Delete "${thread.title || "New thread"}"?`)) return;
  state.threads = state.threads.filter((item) => item.id !== thread.id);
  if (!state.threads.length) {
    createThread(false);
  } else {
    state.selectedThreadId = state.threads[0].id;
  }
  saveThreads();
  render();
}

function addMessage(role, content, label) {
  const thread = currentThread();
  thread.messages.push({ role, content, label, createdAt: new Date().toISOString() });
  thread.messages = thread.messages.slice(-50);
  if (role === "user" && thread.title === "New thread") {
    thread.title = content.slice(0, 48) || "New thread";
  }
  thread.projectId = Number(el.runProjectInput.value) || thread.projectId || state.selectedProjectId || null;
  thread.updatedAt = new Date().toISOString();
  saveThreads();
  renderThreads();
  renderMessages();
}

async function refreshAll() {
  if (!state.apiKey) {
    connected(false);
    renderThreads();
    renderConfigurationSummary();
    renderMessages();
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
  renderThreads();
  renderProjects();
  renderTasks();
  renderModels();
  renderAgents();
  renderConfigurationSummary();
  renderRunOptions();
  renderMessages();
  renderMemory();
}

function renderConfigurationSummary() {
  el.configurationSummary.innerHTML = `
    <article class="summary-item">
      <strong>${state.models.length} model${state.models.length === 1 ? "" : "s"}</strong>
      <span>${state.models.length ? state.models.map((model) => model.name).slice(0, 3).join(", ") : "No providers yet"}</span>
    </article>
    <article class="summary-item">
      <strong>${state.agents.length} agent${state.agents.length === 1 ? "" : "s"}</strong>
      <span>${state.agents.length ? state.agents.map((agent) => agent.name).slice(0, 3).join(", ") : "No agents yet"}</span>
    </article>
  `;
}

function renderThreads() {
  el.threadList.innerHTML = "";
  if (!state.threads.length) {
    el.threadList.innerHTML = '<article class="item"><p>No threads yet.</p></article>';
    return;
  }
  for (const thread of state.threads) {
    const project = state.projects.find((item) => item.id === thread.projectId);
    const item = document.createElement("article");
    item.className = `item thread-item ${thread.id === state.selectedThreadId ? "active" : ""}`;
    item.innerHTML = `
      <div class="item-title">
        <h4>${escapeHtml(thread.title || "New thread")}</h4>
      </div>
      <p>${escapeHtml(project ? project.name : "No project pinned")} - ${thread.messages.length} messages</p>
    `;
    item.addEventListener("click", async () => {
      state.selectedThreadId = thread.id;
      if (thread.projectId) {
        state.selectedProjectId = thread.projectId;
        await loadTasks();
      }
      saveThreads();
      render();
    });
    el.threadList.appendChild(item);
  }
}

function renderProjects() {
  el.projectList.innerHTML = "";
  if (!state.projects.length) {
    el.projectList.innerHTML = '<article class="item"><p>No projects yet.</p></article>';
    return;
  }
  for (const project of state.projects) {
    const item = document.createElement("article");
    item.className = `item ${project.id === state.selectedProjectId ? "active" : ""}`;
    item.innerHTML = `
      <div class="item-title">
        <h4>${escapeHtml(project.name)}</h4>
        <button class="ghost">Open</button>
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
  el.taskTitle.textContent = project ? project.name : "Tasks";
  el.taskList.innerHTML = "";
  if (!project) return;
  if (!state.tasks.length) {
    el.taskList.innerHTML = '<article class="item"><p>No tasks yet.</p></article>';
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
      <div class="button-row">
        <select>${statusOptions.map((status) => `<option value="${status}" ${status === task.status ? "selected" : ""}>${status}</option>`).join("")}</select>
        <button class="ghost">Update</button>
      </div>
    `;
    const select = item.querySelector("select");
    item.querySelector("button").addEventListener("click", async () => {
      await request(`/tasks/${task.id}`, { method: "PATCH", body: { status: select.value } });
      await loadTasks();
      renderTasks();
      renderMemory();
    });
    el.taskList.appendChild(item);
  }
}

function renderModels() {
  el.modelList.innerHTML = "";
  if (!state.models.length) {
    el.modelList.innerHTML = '<article class="mini-item"><p>No models configured.</p></article>';
    return;
  }
  for (const model of state.models) {
    const item = document.createElement("article");
    item.className = "mini-item";
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
    el.agentList.innerHTML = '<article class="mini-item"><p>No agents configured.</p></article>';
    return;
  }
  for (const agent of state.agents) {
    const model = state.models.find((item) => item.id === agent.model_provider_id);
    const item = document.createElement("article");
    item.className = "mini-item";
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
  const selectedProject = String(state.selectedProjectId || "");
  el.runProjectInput.innerHTML = "";
  for (const project of state.projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    el.runProjectInput.appendChild(option);
  }
  if (selectedProject) el.runProjectInput.value = selectedProject;

  const selectedAgent = el.runAgentInput.value;
  el.runAgentInput.innerHTML = "";
  for (const agent of state.agents) {
    const option = document.createElement("option");
    option.value = agent.id;
    option.textContent = `${agent.name} (${agent.role})`;
    el.runAgentInput.appendChild(option);
  }
  if (selectedAgent) el.runAgentInput.value = selectedAgent;
}

function renderMessages() {
  el.messageList.innerHTML = "";
  const thread = currentThread();
  el.threadTitle.textContent = thread.title || "Laura Composer";
  const messages = thread.messages.length
    ? thread.messages
    : [
        {
          role: "system",
          label: "Laura",
          content: "Choose a project and agent, then ask Laura to plan, summarize, debug, or hand work to a model. The selected project memory is attached automatically."
        }
      ];
  for (const message of messages) {
    const item = document.createElement("article");
    item.className = `message ${message.role}`;
    item.innerHTML = `
      <div class="message-label">${escapeHtml(message.label || (message.role === "user" ? "You" : "Laura"))}</div>
      <div class="bubble">${escapeHtml(message.content)}</div>
    `;
    el.messageList.appendChild(item);
  }
  el.messageList.scrollTop = el.messageList.scrollHeight;
}

function renderMemory() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  if (!project) {
    el.memoryPreview.textContent = "No project selected.";
    return;
  }
  const taskLines = state.tasks.map((task) => `- Task #${task.id} [${task.status}]: ${task.instructions}${task.context ? `\n  Context: ${task.context}` : ""}`);
  el.memoryPreview.textContent = state.lastMemory || [
    `Project: ${project.name}`,
    `Description: ${project.description || "None"}`,
    "Tasks:",
    taskLines.length ? taskLines.join("\n") : "No tasks yet."
  ].join("\n");
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

async function saveSetup() {
  const preset = selectedPreset();
  state.baseUrl = el.setupBaseUrlInput.value.trim() || DEFAULT_BASE_URL;
  state.apiKey = el.setupApiKeyInput.value.trim();
  localStorage.setItem("laura_desktop_base_url", state.baseUrl);
  localStorage.setItem("laura_desktop_api_key", state.apiKey);
  el.baseUrlInput.value = state.baseUrl;
  el.apiKeyInput.value = state.apiKey;

  await refreshAll();

  const model = await request("/studio/models", {
    method: "POST",
    body: {
      name: preset.name,
      kind: preset.kind,
      base_url: preset.baseUrl || null,
      model_name: el.setupModelNameInput.value.trim() || preset.model,
      api_key: el.setupProviderKeyInput.value.trim() || null
    }
  });

  await request("/studio/agents", {
    method: "POST",
    body: {
      name: "Coder",
      role: "implementation",
      model_provider_id: model.id,
      system_prompt: el.setupAgentPromptInput.value.trim() || null
    }
  });

  localStorage.setItem("laura_desktop_setup_done", "true");
  closeSetup();
  toast("Setup complete");
  await refreshAll();
}

async function sendMessage() {
  const prompt = el.composerInput.value.trim();
  if (!prompt) return;
  if (!el.runProjectInput.value || !el.runAgentInput.value) {
    toast("Choose a project and agent first");
    return;
  }

  addMessage("user", prompt, "You");
  el.composerInput.value = "";
  const thread = currentThread();
  const pendingIndex = thread.messages.length;
  addMessage("assistant", "Working...", "Laura");

  try {
    const result = await request("/studio/runs", {
      method: "POST",
      body: {
        project_id: Number(el.runProjectInput.value),
        agent_id: Number(el.runAgentInput.value),
        prompt
      }
    });
    state.lastMemory = result.memory_context;
    thread.messages[pendingIndex] = {
      role: "assistant",
      label: `${result.agent_name} - ${result.model_name}`,
      content: result.output,
      createdAt: new Date().toISOString()
    };
    thread.updatedAt = new Date().toISOString();
    saveThreads();
    renderThreads();
    renderMessages();
    renderMemory();
  } catch (error) {
    thread.messages[pendingIndex] = {
      role: "assistant",
      label: "Laura",
      content: `Run failed: ${error.message}`,
      createdAt: new Date().toISOString()
    };
    thread.updatedAt = new Date().toISOString();
    saveThreads();
    renderThreads();
    renderMessages();
    toast("Run failed");
  }
}

el.baseUrlInput.value = state.baseUrl;
el.apiKeyInput.value = state.apiKey;
fillProviderPreset(selectedProvider);
if (!localStorage.getItem("laura_desktop_setup_done") && !state.apiKey) {
  openSetup();
}
el.connectButton.addEventListener("click", async () => {
  state.baseUrl = el.baseUrlInput.value.trim() || DEFAULT_BASE_URL;
  state.apiKey = el.apiKeyInput.value.trim();
  localStorage.setItem("laura_desktop_base_url", state.baseUrl);
  localStorage.setItem("laura_desktop_api_key", state.apiKey);
  await refreshAll();
});
el.openSettingsButton.addEventListener("click", openSettings);
el.closeSettingsButton.addEventListener("click", closeSettings);
el.setupButton.addEventListener("click", openSetup);
el.setupCloseButton.addEventListener("click", closeSetup);
el.setupSaveButton.addEventListener("click", () => saveSetup().catch((error) => toast(error.message)));
document.querySelectorAll(".provider-card").forEach((card) => {
  card.addEventListener("click", () => fillProviderPreset(card.dataset.provider));
});
el.clearButton.addEventListener("click", () => {
  localStorage.removeItem("laura_desktop_api_key");
  state.apiKey = "";
  el.apiKeyInput.value = "";
  connected(false);
});
el.refreshButton.addEventListener("click", refreshAll);
el.newThreadButton.addEventListener("click", () => createThread(true));
el.renameThreadButton.addEventListener("click", renameCurrentThread);
el.clearThreadButton.addEventListener("click", clearCurrentThread);
el.deleteThreadButton.addEventListener("click", deleteCurrentThread);
el.createProjectButton.addEventListener("click", () => createProject().catch((error) => toast(error.message)));
el.createTaskButton.addEventListener("click", () => createTask().catch((error) => toast(error.message)));
el.addModelButton.addEventListener("click", () => addModel().catch((error) => toast(error.message)));
el.addAgentButton.addEventListener("click", () => addAgent().catch((error) => toast(error.message)));
el.runAgentButton.addEventListener("click", () => sendMessage().catch((error) => toast(error.message)));
el.composerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    sendMessage().catch((error) => toast(error.message));
  }
});
el.runProjectInput.addEventListener("change", async () => {
  state.selectedProjectId = Number(el.runProjectInput.value);
  const thread = currentThread();
  thread.projectId = state.selectedProjectId;
  thread.updatedAt = new Date().toISOString();
  saveThreads();
  await loadTasks();
  renderThreads();
  renderProjects();
  renderTasks();
  renderMemory();
});

refreshAll();
