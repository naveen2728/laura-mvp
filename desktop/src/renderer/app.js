const DEFAULT_BASE_URL = "https://web-production-57e37.up.railway.app";
const statusOptions = ["todo", "in-progress", "in-review", "complete"];
const commandPresets = ["npm test", "npm run build", "npm run check", ".\\.venv\\Scripts\\python.exe -m pytest -q"];
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
  remoteThreads: false,
  workspaceRoot: null,
  workspaceFiles: [],
  activeFilePath: null,
  selectedContextPaths: [],
  fileSearch: "",
  pendingEdit: null,
  pendingEdits: [],
  activePendingEditIndex: 0,
  commandRunning: false,
  lastCommandResult: null,
  commandHistory: JSON.parse(localStorage.getItem("laura_desktop_command_history") || "[]"),
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
  openWorkspaceButton: $("#openWorkspaceButton"),
  workspaceRootLabel: $("#workspaceRootLabel"),
  newFilePathInput: $("#newFilePathInput"),
  createFileButton: $("#createFileButton"),
  fileSearchInput: $("#fileSearchInput"),
  fileList: $("#fileList"),
  selectedFilesLabel: $("#selectedFilesLabel"),
  selectVisibleFilesButton: $("#selectVisibleFilesButton"),
  clearContextFilesButton: $("#clearContextFilesButton"),
  activeFileTitle: $("#activeFileTitle"),
  fileEditorInput: $("#fileEditorInput"),
  diffReviewPanel: $("#diffReviewPanel"),
  diffPreview: $("#diffPreview"),
  editProposalInput: $("#editProposalInput"),
  acceptEditButton: $("#acceptEditButton"),
  acceptAllEditsButton: $("#acceptAllEditsButton"),
  rejectEditButton: $("#rejectEditButton"),
  saveFileButton: $("#saveFileButton"),
  insertFileContextButton: $("#insertFileContextButton"),
  proposeFileEditButton: $("#proposeFileEditButton"),
  commandInput: $("#commandInput"),
  commandPresets: $("#commandPresets"),
  commandHistoryInput: $("#commandHistoryInput"),
  runCommandButton: $("#runCommandButton"),
  insertCommandOutputButton: $("#insertCommandOutputButton"),
  askCommandOutputButton: $("#askCommandOutputButton"),
  commandOutput: $("#commandOutput"),
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
  if (state.remoteThreads) {
    localStorage.setItem("laura_desktop_selected_thread", state.selectedThreadId || "");
    return;
  }
  localStorage.setItem("laura_desktop_threads", JSON.stringify(state.threads));
  localStorage.setItem("laura_desktop_selected_thread", state.selectedThreadId || "");
}

function currentThread() {
  let thread = state.threads.find((item) => String(item.id) === String(state.selectedThreadId));
  if (!thread) {
    thread = {
      id: `thread_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      title: "New thread",
      projectId: state.selectedProjectId || null,
      project_id: state.selectedProjectId || null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.threads.unshift(thread);
    state.selectedThreadId = thread.id;
    saveThreads();
  }
  return thread;
}

async function createThread(shouldRender = true) {
  if (state.remoteThreads) {
    const thread = await request("/threads", {
      method: "POST",
      body: {
        title: "New thread",
        project_id: state.selectedProjectId || null
      }
    });
    state.threads.unshift({ ...thread, messages: [] });
    state.selectedThreadId = thread.id;
    saveThreads();
    if (shouldRender) render();
    return state.threads[0];
  }

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

async function renameCurrentThread() {
  const thread = currentThread();
  const title = window.prompt("Thread name", thread.title || "New thread");
  if (!title) return;
  thread.title = title.trim().slice(0, 80) || "New thread";
  thread.updatedAt = new Date().toISOString();
  if (state.remoteThreads) {
    await request(`/threads/${thread.id}`, { method: "PATCH", body: { title: thread.title } });
  }
  saveThreads();
  render();
}

async function clearCurrentThread() {
  const thread = currentThread();
  if (thread.messages.length && !window.confirm("Clear all messages in this thread?")) return;
  if (state.remoteThreads) {
    const projectId = thread.project_id || thread.projectId || null;
    await request(`/threads/${thread.id}`, { method: "DELETE" });
    const replacement = await request("/threads", {
      method: "POST",
      body: { title: thread.title || "New thread", project_id: projectId }
    });
    Object.assign(thread, replacement, { messages: [] });
    state.selectedThreadId = replacement.id;
  } else {
    thread.messages = [];
    thread.updatedAt = new Date().toISOString();
    saveThreads();
  }
  render();
}

async function deleteCurrentThread() {
  const thread = currentThread();
  if (!window.confirm(`Delete "${thread.title || "New thread"}"?`)) return;
  if (state.remoteThreads) {
    await request(`/threads/${thread.id}`, { method: "DELETE" });
  }
  state.threads = state.threads.filter((item) => String(item.id) !== String(thread.id));
  if (!state.threads.length) {
    await createThread(false);
  } else {
    state.selectedThreadId = state.threads[0].id;
    await loadCurrentThreadMessages();
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
    state.remoteThreads = false;
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
    await syncThreads();
    await loadTasks();
    render();
    connected(true);
  } catch (error) {
    connected(false);
    toast(error.message);
  }
}

async function syncThreads() {
  state.remoteThreads = true;
  let threads = await request("/threads");
  if (!threads.length && !localStorage.getItem("laura_desktop_threads_imported")) {
    await importLocalThreads();
    localStorage.setItem("laura_desktop_threads_imported", "true");
    threads = await request("/threads");
  }
  state.threads = threads.map((thread) => ({ ...thread, messages: [] }));
  if (!state.threads.length) {
    await createThread(false);
  } else if (!state.threads.some((thread) => String(thread.id) === String(state.selectedThreadId))) {
    state.selectedThreadId = state.threads[0].id;
  }
  const selected = currentThread();
  state.selectedProjectId = selected.project_id || selected.projectId || state.selectedProjectId;
  await loadCurrentThreadMessages();
  saveThreads();
}

async function importLocalThreads() {
  const localThreads = JSON.parse(localStorage.getItem("laura_desktop_threads") || "[]");
  for (const localThread of localThreads) {
    const projectId = localThread.project_id || localThread.projectId || null;
    const remoteThread = await request("/threads", {
      method: "POST",
      body: {
        title: localThread.title || "Imported thread",
        project_id: projectId && state.projects.some((project) => project.id === projectId) ? projectId : null
      }
    });
    for (const message of localThread.messages || []) {
      if (!message.content) continue;
      await request(`/threads/${remoteThread.id}/messages`, {
        method: "POST",
        body: {
          role: message.role || "assistant",
          label: message.label || null,
          content: message.content || ""
        }
      });
    }
  }
}

async function loadCurrentThreadMessages() {
  if (!state.remoteThreads || !state.selectedThreadId) return;
  const thread = currentThread();
  thread.messages = await request(`/threads/${thread.id}/messages`);
}

async function loadTasks() {
  if (!state.selectedProjectId) {
    state.tasks = [];
    return;
  }
  state.tasks = await request(`/tasks?project_id=${state.selectedProjectId}`);
}

function render() {
  renderWorkspace();
  renderCommandTools();
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

function renderCommandTools() {
  el.commandPresets.innerHTML = "";
  for (const command of commandPresets) {
    const button = document.createElement("button");
    button.className = "ghost";
    button.textContent = command;
    button.title = command;
    button.addEventListener("click", () => {
      el.commandInput.value = command;
      el.commandInput.focus();
    });
    el.commandPresets.appendChild(button);
  }

  el.commandHistoryInput.innerHTML = '<option value="">Recent commands</option>';
  for (const command of state.commandHistory) {
    const option = document.createElement("option");
    option.value = command;
    option.textContent = command;
    el.commandHistoryInput.appendChild(option);
  }
}

function renderWorkspace() {
  el.workspaceRootLabel.textContent = state.workspaceRoot || "No folder selected";
  const contextCount = state.selectedContextPaths.length;
  const visibleFiles = filteredWorkspaceFiles();
  el.selectedFilesLabel.textContent = contextCount
    ? `${contextCount} context file${contextCount === 1 ? "" : "s"}`
    : "No context files";
  el.fileList.innerHTML = "";
  if (!state.workspaceFiles.length) {
    el.fileList.innerHTML = '<article class="item"><p>No files loaded.</p></article>';
    return;
  }
  if (!visibleFiles.length) {
    el.fileList.innerHTML = '<article class="item"><p>No files match.</p></article>';
    return;
  }
  for (const file of visibleFiles) {
    const item = document.createElement("article");
    const selected = state.selectedContextPaths.includes(file);
    item.className = `item file-item ${file === state.activeFilePath ? "active" : ""} ${selected ? "selected-context" : ""}`;
    item.innerHTML = `
      <div class="item-title">
        <button class="file-open-button ghost" title="Open file">${escapeHtml(file)}</button>
        <button class="context-toggle ${selected ? "" : "ghost"}" title="Use as context">${selected ? "Context" : "Add"}</button>
      </div>
    `;
    item.querySelector(".file-open-button").addEventListener("click", () => openWorkspaceFile(file).catch((error) => toast(error.message)));
    item.querySelector(".context-toggle").addEventListener("click", (event) => {
      event.stopPropagation();
      toggleContextFile(file);
    });
    el.fileList.appendChild(item);
  }
}

function clearPendingEdit() {
  state.pendingEdit = null;
  state.pendingEdits = [];
  state.activePendingEditIndex = 0;
  el.diffReviewPanel.classList.add("hidden");
  el.diffPreview.textContent = "";
  el.editProposalInput.innerHTML = "";
}

function buildLineDiff(before, after) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const lines = [];
  for (let index = 0; index < max; index += 1) {
    const oldLine = beforeLines[index];
    const newLine = afterLines[index];
    if (oldLine === newLine) {
      if (oldLine !== undefined) lines.push(`  ${oldLine}`);
    } else {
      if (oldLine !== undefined) lines.push(`- ${oldLine}`);
      if (newLine !== undefined) lines.push(`+ ${newLine}`);
    }
  }
  return lines.join("\n");
}

function showPendingEditAt(index) {
  const edit = state.pendingEdits[index];
  if (!edit) return;
  state.activePendingEditIndex = index;
  state.pendingEdit = edit;
  state.activeFilePath = edit.path;
  el.activeFileTitle.textContent = edit.path;
  el.fileEditorInput.value = edit.originalContent;
  el.editProposalInput.value = String(index);
  el.diffPreview.textContent = buildLineDiff(edit.originalContent, edit.proposedContent);
  el.diffReviewPanel.classList.remove("hidden");
  renderWorkspace();
}

function filteredWorkspaceFiles() {
  const query = state.fileSearch.trim().toLowerCase();
  if (!query) return state.workspaceFiles;
  const terms = query.split(/\s+/).filter(Boolean);
  return state.workspaceFiles.filter((file) => {
    const haystack = file.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

function selectVisibleContextFiles() {
  const visibleFiles = filteredWorkspaceFiles();
  if (!visibleFiles.length) return toast("No visible files to add");
  state.selectedContextPaths = [...new Set([...state.selectedContextPaths, ...visibleFiles])];
  renderWorkspace();
  toast(`Added ${visibleFiles.length} visible file${visibleFiles.length === 1 ? "" : "s"}`);
}

function showPendingEdits(edits) {
  state.pendingEdits = edits;
  state.activePendingEditIndex = 0;
  el.editProposalInput.innerHTML = "";
  edits.forEach((edit, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${edit.path}`;
    el.editProposalInput.appendChild(option);
  });
  showPendingEditAt(0);
}

function toggleContextFile(filePath) {
  if (state.selectedContextPaths.includes(filePath)) {
    state.selectedContextPaths = state.selectedContextPaths.filter((item) => item !== filePath);
  } else {
    state.selectedContextPaths = [...state.selectedContextPaths, filePath];
  }
  renderWorkspace();
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
    const threadProjectId = thread.project_id || thread.projectId;
    const project = state.projects.find((item) => item.id === threadProjectId);
    const item = document.createElement("article");
    const messageCount = thread.messages.length || thread.message_count || 0;
    item.className = `item thread-item ${String(thread.id) === String(state.selectedThreadId) ? "active" : ""}`;
    item.innerHTML = `
      <div class="item-title">
        <h4>${escapeHtml(thread.title || "New thread")}</h4>
      </div>
      <p>${escapeHtml(project ? project.name : "No project pinned")} - ${messageCount} messages</p>
    `;
    item.addEventListener("click", async () => {
      state.selectedThreadId = thread.id;
      if (threadProjectId) {
        state.selectedProjectId = threadProjectId;
        await loadTasks();
      }
      await loadCurrentThreadMessages();
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

async function openWorkspace() {
  const workspace = await window.lauraDesktop.openWorkspace();
  if (!workspace) return;
  state.workspaceRoot = workspace.root;
  state.workspaceFiles = workspace.files;
  state.activeFilePath = null;
  state.selectedContextPaths = [];
  state.fileSearch = "";
  el.fileSearchInput.value = "";
  clearPendingEdit();
  el.fileEditorInput.value = "";
  el.activeFileTitle.textContent = "File";
  renderWorkspace();
  toast("Workspace opened");
}

async function openWorkspaceFile(filePath) {
  const file = await window.lauraDesktop.readFile(filePath);
  state.activeFilePath = file.path;
  clearPendingEdit();
  el.activeFileTitle.textContent = file.path;
  el.fileEditorInput.value = file.content;
  renderWorkspace();
}

async function saveWorkspaceFile() {
  if (!state.activeFilePath) return toast("Open a file first");
  const result = await window.lauraDesktop.writeFile({
    path: state.activeFilePath,
    content: el.fileEditorInput.value
  });
  state.workspaceFiles = result.files;
  clearPendingEdit();
  renderWorkspace();
  toast("File saved");
}

async function createWorkspaceFile() {
  const filePath = el.newFilePathInput.value.trim();
  if (!filePath) return toast("Enter a file path");
  const result = await window.lauraDesktop.writeFile({ path: filePath, content: "" });
  state.workspaceFiles = result.files;
  el.newFilePathInput.value = "";
  await openWorkspaceFile(filePath);
  toast("File created");
}

async function insertFileContext() {
  const contextFiles = await readContextFiles();
  if (!contextFiles.length) return toast("Open a file first");
  const snippet = contextFiles.map((file) => [
    `File: ${file.path}`,
    "```",
    file.content,
    "```",
  ].join("\n")).join("\n\n");
  el.composerInput.value = `${el.composerInput.value.trim()}\n\n${snippet}`.trim();
  el.composerInput.focus();
}

function parseEditResponse(output) {
  const trimmed = output.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const parsed = JSON.parse(candidate);
  if (Array.isArray(parsed)) return { edits: parsed };
  if (Array.isArray(parsed.edits)) return parsed;
  return { edits: [parsed] };
}

async function readContextFiles() {
  const paths = state.selectedContextPaths.length
    ? state.selectedContextPaths
    : state.activeFilePath
      ? [state.activeFilePath]
      : [];
  const uniquePaths = [...new Set(paths)];
  const files = [];
  for (const filePath of uniquePaths) {
    if (filePath === state.activeFilePath) {
      files.push({ path: filePath, content: el.fileEditorInput.value });
    } else {
      files.push(await window.lauraDesktop.readFile(filePath));
    }
  }
  return files;
}

async function normalizeProposedEdits(rawEdits, contextFiles) {
  const originals = new Map(contextFiles.map((file) => [file.path, file.content]));
  const normalized = [];
  for (const rawEdit of rawEdits) {
    if (!rawEdit.path || typeof rawEdit.content !== "string") continue;
    let originalContent = originals.get(rawEdit.path);
    if (originalContent === undefined) {
      try {
        originalContent = (await window.lauraDesktop.readFile(rawEdit.path)).content;
      } catch {
        originalContent = "";
      }
    }
    normalized.push({
      path: rawEdit.path,
      originalContent,
      proposedContent: rawEdit.content,
      summary: rawEdit.summary || "Review it in the file panel."
    });
  }
  return normalized;
}

async function proposeFileEdit() {
  if (!state.activeFilePath) return toast("Open a file first");
  if (!el.runProjectInput.value || !el.runAgentInput.value) return toast("Choose a project and agent first");
  const contextFiles = await readContextFiles();
  const instruction = el.composerInput.value.trim() || "Improve this file while preserving its purpose.";
  const fileBlocks = contextFiles.map((file) => [
    `File path: ${file.path}`,
    "```",
    file.content,
    "```"
  ].join("\n")).join("\n\n");
  const prompt = [
    "Return ONLY valid JSON with this exact shape:",
    "{\"edits\":[{\"path\":\"relative/file/path\",\"content\":\"complete new file content\",\"summary\":\"short summary\"}]}",
    "You may return one or more edits. Only include files that should change.",
    "Do not include markdown, comments outside JSON, or partial patches.",
    "",
    "Workspace files provided as context:",
    fileBlocks,
    "",
    `Requested change: ${instruction}`,
  ].join("\n");

  toast("Asking agent for edit");
  const result = await request("/studio/runs", {
    method: "POST",
    body: {
      project_id: Number(el.runProjectInput.value),
      agent_id: Number(el.runAgentInput.value),
      thread_id: state.remoteThreads ? Number(currentThread().id) : null,
      prompt
    }
  });

  let parsed;
  try {
    parsed = parseEditResponse(result.output);
  } catch {
    addMessage("assistant", result.output, `${result.agent_name} - ${result.model_name}`);
    toast("Agent did not return JSON");
    return;
  }

  const edits = await normalizeProposedEdits(parsed.edits, contextFiles);
  if (!edits.length) {
    toast("Edit response had no usable edits");
    return;
  }

  state.activeFilePath = edits[0].path;
  el.activeFileTitle.textContent = edits[0].path;
  el.fileEditorInput.value = edits[0].originalContent;
  showPendingEdits(edits);
  const summary = edits.map((edit) => `- ${edit.path}: ${edit.summary}`).join("\n");
  addMessage("assistant", `Proposed ${edits.length} file edit${edits.length === 1 ? "" : "s"}:\n${summary}`, `${result.agent_name} - ${result.model_name}`);
  toast(`${edits.length} edit preview${edits.length === 1 ? "" : "s"} ready`);
}

async function acceptPendingEdit() {
  if (!state.pendingEdit) return;
  const acceptedPath = state.pendingEdit.path;
  const result = await window.lauraDesktop.writeFile({
    path: acceptedPath,
    content: state.pendingEdit.proposedContent
  });
  state.workspaceFiles = result.files;
  state.activeFilePath = acceptedPath;
  el.activeFileTitle.textContent = acceptedPath;
  el.fileEditorInput.value = state.pendingEdit.proposedContent;
  state.pendingEdits.splice(state.activePendingEditIndex, 1);
  if (state.pendingEdits.length) {
    showPendingEdits(state.pendingEdits);
    toast("Edit applied. Review the next one.");
  } else {
    clearPendingEdit();
    renderWorkspace();
    toast("Edit applied");
  }
}

async function acceptAllPendingEdits() {
  if (!state.pendingEdits.length) return;
  const edits = [...state.pendingEdits];
  let latestFiles = state.workspaceFiles;
  for (const edit of edits) {
    const result = await window.lauraDesktop.writeFile({
      path: edit.path,
      content: edit.proposedContent
    });
    latestFiles = result.files;
  }
  const lastEdit = edits[edits.length - 1];
  state.workspaceFiles = latestFiles;
  state.activeFilePath = lastEdit.path;
  el.activeFileTitle.textContent = lastEdit.path;
  el.fileEditorInput.value = lastEdit.proposedContent;
  clearPendingEdit();
  renderWorkspace();
  toast(`Applied ${edits.length} edit${edits.length === 1 ? "" : "s"}`);
}

async function runWorkspaceCommand() {
  if (state.commandRunning) return;
  const command = el.commandInput.value.trim();
  if (!command) return toast("Enter a command");
  saveCommandHistory(command);
  state.commandRunning = true;
  el.runCommandButton.disabled = true;
  el.runCommandButton.textContent = "Running";
  el.commandOutput.textContent = `> ${command}\n\nRunning...`;

  try {
    const result = await window.lauraDesktop.runCommand({ command });
    state.lastCommandResult = result;
    const sections = [
      `> ${result.command}`,
      `exit ${result.exitCode}`,
      result.stdout ? `\nstdout\n${result.stdout.trimEnd()}` : "",
      result.stderr ? `\nstderr\n${result.stderr.trimEnd()}` : ""
    ].filter(Boolean);
    el.commandOutput.textContent = sections.join("\n");
    if (result.exitCode === 0) {
      toast("Command finished");
    } else {
      toast(`Command exited ${result.exitCode}`);
    }
  } finally {
    state.commandRunning = false;
    el.runCommandButton.disabled = false;
    el.runCommandButton.textContent = "Run";
  }
}

function saveCommandHistory(command) {
  state.commandHistory = [command, ...state.commandHistory.filter((item) => item !== command)].slice(0, 12);
  localStorage.setItem("laura_desktop_command_history", JSON.stringify(state.commandHistory));
  renderCommandTools();
}

function formatCommandOutputPrompt() {
  if (!state.lastCommandResult) return toast("Run a command first");
  const result = state.lastCommandResult;
  return [
    "Command output:",
    "```",
    `> ${result.command}`,
    `exit ${result.exitCode}`,
    result.stdout ? `stdout\n${result.stdout.trimEnd()}` : "",
    result.stderr ? `stderr\n${result.stderr.trimEnd()}` : "",
    "```",
    "",
    result.exitCode === 0 ? "Summarize this result." : "Explain why this failed and propose a fix."
  ].filter((line) => line !== "").join("\n");
}

function insertCommandOutput() {
  const snippet = formatCommandOutputPrompt();
  if (!snippet) return;
  el.composerInput.value = `${el.composerInput.value.trim()}\n\n${snippet}`.trim();
  el.composerInput.focus();
}

async function askAboutCommandOutput() {
  const prompt = formatCommandOutputPrompt();
  if (!prompt) return;
  await sendMessage(prompt);
}

function rejectPendingEdit() {
  if (!state.pendingEdit) return;
  el.fileEditorInput.value = state.pendingEdit.originalContent;
  state.pendingEdits.splice(state.activePendingEditIndex, 1);
  if (state.pendingEdits.length) {
    showPendingEdits(state.pendingEdits);
    toast("Edit rejected");
  } else {
    clearPendingEdit();
    toast("Edit rejected");
  }
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

async function sendMessage(preparedPrompt) {
  const prompt = (preparedPrompt || el.composerInput.value).trim();
  if (!prompt) return;
  if (!el.runProjectInput.value || !el.runAgentInput.value) {
    toast("Choose a project and agent first");
    return;
  }

  addMessage("user", prompt, "You");
  if (state.remoteThreads) {
    const activeThread = currentThread();
    await request(`/threads/${activeThread.id}`, {
      method: "PATCH",
      body: { title: activeThread.title, project_id: Number(el.runProjectInput.value) || null }
    });
    await request(`/threads/${currentThread().id}/messages`, {
      method: "POST",
      body: { role: "user", label: "You", content: prompt }
    });
  }
  if (!preparedPrompt) {
    el.composerInput.value = "";
  }
  const thread = currentThread();
  const pendingIndex = thread.messages.length;
  addMessage("assistant", "Working...", "Laura");

  try {
    const result = await request("/studio/runs", {
      method: "POST",
      body: {
        project_id: Number(el.runProjectInput.value),
        agent_id: Number(el.runAgentInput.value),
        thread_id: state.remoteThreads ? Number(thread.id) : null,
        prompt
      }
    });
    state.lastMemory = result.memory_context;
    const assistantMessage = {
      role: "assistant",
      label: `${result.agent_name} - ${result.model_name}`,
      content: result.output,
      createdAt: new Date().toISOString()
    };
    if (state.remoteThreads) {
      const saved = await request(`/threads/${thread.id}/messages`, {
        method: "POST",
        body: {
          role: assistantMessage.role,
          label: assistantMessage.label,
          content: assistantMessage.content
        }
      });
      thread.messages[pendingIndex] = saved;
    } else {
      thread.messages[pendingIndex] = assistantMessage;
    }
    thread.updatedAt = new Date().toISOString();
    saveThreads();
    renderThreads();
    renderMessages();
    renderMemory();
  } catch (error) {
    const errorMessage = {
      role: "assistant",
      label: "Laura",
      content: `Run failed: ${error.message}`,
      createdAt: new Date().toISOString()
    };
    if (state.remoteThreads) {
      const saved = await request(`/threads/${thread.id}/messages`, {
        method: "POST",
        body: {
          role: errorMessage.role,
          label: errorMessage.label,
          content: errorMessage.content
        }
      });
      thread.messages[pendingIndex] = saved;
    } else {
      thread.messages[pendingIndex] = errorMessage;
    }
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
el.openWorkspaceButton.addEventListener("click", () => openWorkspace().catch((error) => toast(error.message)));
el.createFileButton.addEventListener("click", () => createWorkspaceFile().catch((error) => toast(error.message)));
el.fileSearchInput.addEventListener("input", () => {
  state.fileSearch = el.fileSearchInput.value;
  renderWorkspace();
});
el.selectVisibleFilesButton.addEventListener("click", selectVisibleContextFiles);
el.saveFileButton.addEventListener("click", () => saveWorkspaceFile().catch((error) => toast(error.message)));
el.insertFileContextButton.addEventListener("click", () => insertFileContext().catch((error) => toast(error.message)));
el.proposeFileEditButton.addEventListener("click", () => proposeFileEdit().catch((error) => toast(error.message)));
el.acceptEditButton.addEventListener("click", () => acceptPendingEdit().catch((error) => toast(error.message)));
el.acceptAllEditsButton.addEventListener("click", () => acceptAllPendingEdits().catch((error) => toast(error.message)));
el.rejectEditButton.addEventListener("click", rejectPendingEdit);
el.runCommandButton.addEventListener("click", () => runWorkspaceCommand().catch((error) => toast(error.message)));
el.insertCommandOutputButton.addEventListener("click", insertCommandOutput);
el.askCommandOutputButton.addEventListener("click", () => askAboutCommandOutput().catch((error) => toast(error.message)));
el.commandHistoryInput.addEventListener("change", () => {
  if (!el.commandHistoryInput.value) return;
  el.commandInput.value = el.commandHistoryInput.value;
  el.commandHistoryInput.value = "";
  el.commandInput.focus();
});
el.commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runWorkspaceCommand().catch((error) => toast(error.message));
  }
});
el.clearContextFilesButton.addEventListener("click", () => {
  state.selectedContextPaths = [];
  renderWorkspace();
});
el.editProposalInput.addEventListener("change", () => showPendingEditAt(Number(el.editProposalInput.value)));
el.newThreadButton.addEventListener("click", () => createThread(true).catch((error) => toast(error.message)));
el.renameThreadButton.addEventListener("click", () => renameCurrentThread().catch((error) => toast(error.message)));
el.clearThreadButton.addEventListener("click", () => clearCurrentThread().catch((error) => toast(error.message)));
el.deleteThreadButton.addEventListener("click", () => deleteCurrentThread().catch((error) => toast(error.message)));
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
  thread.project_id = state.selectedProjectId;
  thread.updatedAt = new Date().toISOString();
  if (state.remoteThreads) {
    await request(`/threads/${thread.id}`, { method: "PATCH", body: { project_id: state.selectedProjectId } });
  }
  saveThreads();
  await loadTasks();
  renderThreads();
  renderProjects();
  renderTasks();
  renderMemory();
});

renderCommandTools();
refreshAll();
