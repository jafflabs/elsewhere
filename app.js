(() => {
  "use strict";

  const CONFIG = window.ELSEWHERE_CONFIG;
  const TYPES = ["Job", "Employer", "Organization", "Place", "Property", "Resource", "Credential", "Trip idea", "Other"];
  const POSITIVE_REACTIONS = new Set(["nah_yeah", "yeah_nah_yeah", "love"]);
  const LOCAL_KEY = "elsewhere_local_v1";
  const LOCAL_PERSON_KEY = "elsewhere_local_person";
  const LAST_VIEW_KEY = "elsewhere_last_view";

  const state = {
    mode: "local",
    authMode: "signin",
    client: null,
    user: null,
    profile: null,
    workspace: null,
    members: [],
    possibilities: [],
    reactions: [],
    observations: [],
    mapPins: [],
    localPerson: localStorage.getItem(LOCAL_PERSON_KEY) || "Brad",
    selectedSearchPerson: "Brad",
    selectedLensKey: null,
    selectedRegionKey: "new-england"
  };

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeUrl(value = "") {
    const text = String(value).trim();
    if (!text) return "";
    return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  }

  function splitTags(value = "") {
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value).split(",").map(x => x.trim()).filter(Boolean).slice(0, 20);
  }

  function humanDate(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function googleUrl(query) {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function mapsUrl(query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function linkedinUrl(query, place) {
    return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(place)}`;
  }

  function indeedUrl(query, place) {
    return `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(place)}`;
  }

  function regionByKey(key) {
    return CONFIG.regions.find(r => r.key === key) || null;
  }

  function currentPersonName() {
    if (state.mode === "local") return state.localPerson;
    return state.profile?.display_name || state.user?.email?.split("@")[0] || "You";
  }

  function currentUserId() {
    return state.mode === "local" ? state.localPerson.toLowerCase() : state.user?.id;
  }

  function memberName(userId) {
    const member = state.members.find(m => m.user_id === userId);
    return member?.display_name || (userId === "brad" ? "Brad" : userId === "sam" ? "Sam" : "Member");
  }

  function reactionDefinition(key) {
    return CONFIG.reactions.find(r => r.key === key) || null;
  }

  function showToast(message) {
    const toast = qs("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1900);
  }

  function emptyState(container, copy) {
    const template = qs("#emptyTemplate");
    const node = template.content.cloneNode(true);
    if (copy) qs(".empty-state p", node).textContent = copy;
    container.replaceChildren(node);
  }

  // ---------------------------------------------------------------------------
  // Local preview store
  // ---------------------------------------------------------------------------

  class LocalStore {
    constructor() {
      this.state = this.read();
    }

    fresh() {
      return {
        workspace: { id: "local-workspace", name: "Elsewhere", join_code: "LOCAL", created_at: new Date().toISOString() },
        members: [
          { user_id: "brad", display_name: "Brad", role: "owner" },
          { user_id: "sam", display_name: "Sam", role: "member" }
        ],
        possibilities: [],
        reactions: [],
        observations: [],
        map_pins: []
      };
    }

    read() {
      try {
        const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY));
        if (!parsed) return this.fresh();
        return { ...this.fresh(), ...parsed, map_pins: Array.isArray(parsed.map_pins) ? parsed.map_pins : [] };
      } catch {
        return this.fresh();
      }
    }

    write() {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(this.state));
    }

    async load() { return structuredClone(this.state); }

    async addPossibility(record) {
      const saved = { ...record, id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: currentUserId() };
      this.state.possibilities.unshift(saved);
      this.write();
      return saved;
    }

    async deletePossibility(id) {
      this.state.possibilities = this.state.possibilities.filter(x => x.id !== id);
      this.state.reactions = this.state.reactions.filter(x => x.possibility_id !== id);
      this.write();
    }

    async setReaction(possibilityId, reaction) {
      const userId = currentUserId();
      this.state.reactions = this.state.reactions.filter(r => !(r.possibility_id === possibilityId && r.user_id === userId));
      if (reaction) this.state.reactions.push({ id: uid(), possibility_id: possibilityId, user_id: userId, reaction, created_at: new Date().toISOString() });
      this.write();
    }

    async addObservation(record) {
      const saved = { ...record, id: uid(), author_id: currentUserId(), created_at: new Date().toISOString() };
      this.state.observations.unshift(saved);
      this.write();
      return saved;
    }

    async deleteObservation(id) {
      this.state.observations = this.state.observations.filter(x => x.id !== id);
      this.write();
    }

    async addMapPin(record) {
      const saved = { ...record, id: uid(), created_by: currentUserId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      this.state.map_pins.unshift(saved);
      this.write();
      return saved;
    }

    async deleteMapPin(id) {
      this.state.map_pins = this.state.map_pins.filter(x => x.id !== id);
      this.write();
    }

    async reset() {
      this.state = this.fresh();
      this.write();
      return this.load();
    }
  }

  // ---------------------------------------------------------------------------
  // Supabase store
  // ---------------------------------------------------------------------------

  class SupabaseStore {
    constructor(client) { this.client = client; }

    async session() {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      return data.session;
    }

    async signUp(name, email, password) {
      return this.client.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: window.location.origin
        }
      });
    }

    async signIn(email, password) {
      return this.client.auth.signInWithPassword({ email, password });
    }

    async signOut() { return this.client.auth.signOut(); }

    async getProfile(userId) {
      const { data, error } = await this.client.from("profiles").select("id,display_name").eq("id", userId).single();
      if (error) throw error;
      return data;
    }

    async getWorkspaceContext(userId) {
      const { data, error } = await this.client
        .from("workspace_members")
        .select("workspace_id,role,workspaces!inner(id,name,join_code,created_at)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const workspace = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces;
      return { workspace, role: data.role };
    }

    async createWorkspace() {
      const { data, error } = await this.client.rpc("create_elsewhere_workspace", { workspace_name: "Elsewhere" });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    }

    async joinWorkspace(code) {
      const { data, error } = await this.client.rpc("join_elsewhere_workspace", { code: String(code).trim().toUpperCase() });
      if (error) throw error;
      return data;
    }

    async load(workspaceId) {
      const [membersRes, possibilitiesRes, reactionsRes, observationsRes, mapPinsRes] = await Promise.all([
        this.client.from("workspace_members").select("user_id,role,profiles(display_name)").eq("workspace_id", workspaceId),
        this.client.from("possibilities").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
        this.client.from("reactions").select("*").eq("workspace_id", workspaceId),
        this.client.from("observations").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
        this.client.from("map_pins").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false })
      ]);
      [membersRes, possibilitiesRes, reactionsRes, observationsRes, mapPinsRes].forEach(result => { if (result.error) throw result.error; });
      return {
        members: membersRes.data.map(m => ({ user_id: m.user_id, role: m.role, display_name: m.profiles?.display_name || "Member" })),
        possibilities: possibilitiesRes.data || [],
        reactions: reactionsRes.data || [],
        observations: observationsRes.data || [],
        map_pins: mapPinsRes.data || []
      };
    }

    async addPossibility(record) {
      const payload = { ...record, workspace_id: state.workspace.id, created_by: state.user.id };
      const { data, error } = await this.client.from("possibilities").insert(payload).select().single();
      if (error) throw error;
      return data;
    }

    async deletePossibility(id) {
      const { error } = await this.client.from("possibilities").delete().eq("id", id);
      if (error) throw error;
    }

    async setReaction(possibilityId, reaction) {
      const userId = state.user.id;
      if (!reaction) {
        const { error } = await this.client.from("reactions").delete().eq("possibility_id", possibilityId).eq("user_id", userId);
        if (error) throw error;
        return;
      }
      const payload = { workspace_id: state.workspace.id, possibility_id: possibilityId, user_id: userId, reaction };
      const { error } = await this.client.from("reactions").upsert(payload, { onConflict: "possibility_id,user_id" });
      if (error) throw error;
    }

    async addObservation(record) {
      const payload = { ...record, workspace_id: state.workspace.id, author_id: state.user.id };
      const { data, error } = await this.client.from("observations").insert(payload).select().single();
      if (error) throw error;
      return data;
    }

    async deleteObservation(id) {
      const { error } = await this.client.from("observations").delete().eq("id", id);
      if (error) throw error;
    }

    async addMapPin(record) {
      const payload = { ...record, workspace_id: state.workspace.id, created_by: state.user.id };
      const { data, error } = await this.client.from("map_pins").insert(payload).select().single();
      if (error) throw error;
      return data;
    }

    async deleteMapPin(id) {
      const { error } = await this.client.from("map_pins").delete().eq("id", id);
      if (error) throw error;
    }
  }

  let store;
  let elsewhereMap = null;
  let mapPinLayer = null;
  const mapMarkers = new Map();

  function supabaseConfigured() {
    const { url, publishableKey } = CONFIG.supabase || {};
    return Boolean(url && publishableKey && /^https:\/\//.test(url));
  }

  // ---------------------------------------------------------------------------
  // App initialization
  // ---------------------------------------------------------------------------

  async function loadSupabaseLibrary() {
    if (window.supabase?.createClient) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Supabase client library could not be loaded."));
      document.head.appendChild(script);
    });
  }

  async function init() {
    populateStaticControls();
    wireEvents();

    if (supabaseConfigured()) {
      await loadSupabaseLibrary();
      state.mode = "shared";
      state.client = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.publishableKey);
      store = new SupabaseStore(state.client);
      await initShared();
    } else {
      state.mode = "local";
      store = new LocalStore();
      await initLocal();
    }

    navigate(localStorage.getItem(LAST_VIEW_KEY) || "home", false);
    renderAll();
  }

  async function initLocal() {
    const data = await store.load();
    state.workspace = data.workspace;
    state.members = data.members;
    state.possibilities = data.possibilities;
    state.reactions = data.reactions;
    state.observations = data.observations;
    state.mapPins = data.map_pins || [];
    updateModeUI();
  }

  async function initShared() {
    updateModeUI(true);
    try {
      const session = await store.session();
      if (!session) {
        openLockedDialog(qs("#authDialog"));
        return;
      }
      await acceptSession(session);
    } catch (error) {
      console.error(error);
      showToast("Couldn't connect to the shared workspace.");
      openLockedDialog(qs("#authDialog"));
    }

    state.client.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        clearSharedState();
        openLockedDialog(qs("#authDialog"));
      } else if (session && !state.user) {
        await acceptSession(session);
        renderAll();
      }
    });
  }

  async function acceptSession(session) {
    state.user = session.user;
    state.profile = await store.getProfile(session.user.id);
    const context = await store.getWorkspaceContext(session.user.id);
    qs("#authDialog")?.close();

    if (!context) {
      openLockedDialog(qs("#workspaceDialog"));
      updateModeUI();
      return;
    }

    state.workspace = context.workspace;
    await loadSharedData();
    qs("#workspaceDialog")?.close();
    updateModeUI();
  }

  async function loadSharedData() {
    if (!state.workspace) return;
    const data = await store.load(state.workspace.id);
    state.members = data.members;
    state.possibilities = data.possibilities;
    state.reactions = data.reactions;
    state.observations = data.observations;
    state.mapPins = data.map_pins || [];
  }

  function clearSharedState() {
    state.user = null;
    state.profile = null;
    state.workspace = null;
    state.members = [];
    state.possibilities = [];
    state.reactions = [];
    state.observations = [];
    state.mapPins = [];
    updateModeUI();
  }

  function openLockedDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  // ---------------------------------------------------------------------------
  // Navigation and static controls
  // ---------------------------------------------------------------------------

  function populateStaticControls() {
    qs("#searchPerson").innerHTML = ["Brad", "Sam", "Us"].map(x => `<option>${x}</option>`).join("");
    const regionOptions = CONFIG.regions.map(r => `<option value="${escapeHtml(r.key)}">${escapeHtml(r.name)}</option>`).join("");
    qs("#searchRegion").innerHTML = regionOptions;
    qs("#filterRegion").insertAdjacentHTML("beforeend", regionOptions);
    qs("#possibilityRegion").insertAdjacentHTML("beforeend", regionOptions);
    qs("#observationRegion").insertAdjacentHTML("beforeend", regionOptions);
    qs("#mapPinRegion").insertAdjacentHTML("beforeend", regionOptions);
    qs("#possibilityType").innerHTML = TYPES.map(x => `<option>${escapeHtml(x)}</option>`).join("");
    qs("#filterType").insertAdjacentHTML("beforeend", TYPES.map(x => `<option>${escapeHtml(x)}</option>`).join(""));
    updateLensSelect();
  }

  function updateLensSelect() {
    const person = qs("#searchPerson").value || state.selectedSearchPerson;
    state.selectedSearchPerson = person;
    const lenses = CONFIG.searchLenses[person];
    if (!state.selectedLensKey || !lenses.some(l => l.key === state.selectedLensKey)) state.selectedLensKey = lenses[0].key;
    qs("#searchLens").innerHTML = lenses.map(l => `<option value="${escapeHtml(l.key)}" ${l.key === state.selectedLensKey ? "selected" : ""}>${escapeHtml(l.name)}</option>`).join("");
    qs("#lensHeading").textContent = person === "Us" ? "Our life lenses" : `${person}'s paths`;
    renderLensCards();
  }

  function navigate(view, scroll = true) {
    const valid = ["home", "explore", "possibilities", "places", "map", "learning", "backup"];
    if (!valid.includes(view)) view = "home";
    qsa("[data-view-panel]").forEach(el => el.classList.toggle("active", el.dataset.viewPanel === view));
    qsa("[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === view));
    localStorage.setItem(LAST_VIEW_KEY, view);
    if (view === "map") setTimeout(ensureMap, 0);
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startExplore(person) {
    qs("#searchPerson").value = person;
    updateLensSelect();
    buildSearches();
    navigate("explore");
  }

  function randomThread() {
    const people = ["Brad", "Sam", "Us"];
    const person = people[Math.floor(Math.random() * people.length)];
    const lenses = CONFIG.searchLenses[person];
    const lens = lenses[Math.floor(Math.random() * lenses.length)];
    const regions = CONFIG.regions.filter(r => r.key !== "new-england");
    const region = regions[Math.floor(Math.random() * regions.length)];
    qs("#searchPerson").value = person;
    state.selectedLensKey = lens.key;
    updateLensSelect();
    qs("#searchLens").value = lens.key;
    qs("#searchRegion").value = region.key;
    buildSearches();
    navigate("explore");
    showToast(`${person} · ${lens.name} · ${region.name}`);
  }

  // ---------------------------------------------------------------------------
  // Search studio
  // ---------------------------------------------------------------------------

  function buildSearches() {
    const person = qs("#searchPerson").value;
    const lens = CONFIG.searchLenses[person].find(l => l.key === qs("#searchLens").value) || CONFIG.searchLenses[person][0];
    const region = regionByKey(qs("#searchRegion").value) || CONFIG.regions[0];
    state.selectedSearchPerson = person;
    state.selectedLensKey = lens.key;
    state.selectedRegionKey = region.key;

    const termQuery = lens.terms.map(term => `"${term}"`).join(" OR ");
    const broadQuery = `${termQuery} ${region.searchPlace}`;
    let results;

    if (person === "Us") {
      const first = lens.terms[0];
      results = [
        { source: "Google", title: `${lens.name} — ${region.name}`, note: "Broad web reconnaissance.", url: googleUrl(`${broadQuery}`) },
        { source: "Maps", title: `See it on the map`, note: "Explore nearby places and local context.", url: mapsUrl(`${first} ${region.searchPlace}`) },
        { source: "Housing", title: `Housing & land signals`, note: "Search major property sources without locking into one portal.", url: googleUrl(`(${lens.terms.slice(0,2).join(" OR ")}) ${region.searchPlace} (site:zillow.com OR site:realtor.com OR site:redfin.com)`) },
        { source: "Local ecosystem", title: `What lives around here?`, note: "Community, access, recreation, and regional context.", url: googleUrl(`${lens.ecosystem} ${region.searchPlace}`) }
      ];
    } else {
      const titleQuery = lens.terms.slice(0, 3).join(" OR ");
      results = [
        { source: "Google", title: `${lens.name} — ${region.name}`, note: "Broad job + organization discovery.", url: googleUrl(`${broadQuery} jobs`) },
        { source: "LinkedIn", title: `Current role vocabulary`, note: "See how employers describe this work.", url: linkedinUrl(titleQuery, region.searchPlace) },
        { source: "Indeed", title: `Current openings`, note: "A second view of active postings.", url: indeedUrl(titleQuery, region.searchPlace) },
        { source: "Ecosystem", title: `Organizations around the work`, note: "Look beyond open jobs to employers, communities, and institutions.", url: googleUrl(`${lens.ecosystem} ${region.searchPlace}`) }
      ];
    }

    qs("#searchSummary").innerHTML = `<strong>${escapeHtml(person)} · ${escapeHtml(lens.name)} · ${escapeHtml(region.name)}</strong><br>${escapeHtml(lens.terms.join(" · "))}`;
    qs("#searchResults").innerHTML = results.map(result => `
      <article class="search-result">
        <span class="source">${escapeHtml(result.source)}</span>
        <strong>${escapeHtml(result.title)}</strong>
        <p>${escapeHtml(result.note)}</p>
        <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">Open search ↗</a>
      </article>`).join("");
    renderLensCards();
  }

  function renderLensCards() {
    const person = qs("#searchPerson").value || "Brad";
    const lenses = CONFIG.searchLenses[person];
    qs("#lensCards").innerHTML = lenses.map(lens => `
      <article class="lens-card ${lens.key === qs("#searchLens").value ? "selected" : ""}" data-lens="${escapeHtml(lens.key)}">
        <strong>${escapeHtml(lens.name)}</strong>
        <span>${escapeHtml(lens.terms.join(" · "))}</span>
      </article>`).join("");
  }

  // ---------------------------------------------------------------------------
  // Possibilities
  // ---------------------------------------------------------------------------

  function filteredPossibilities() {
    const audience = qs("#filterAudience").value;
    const type = qs("#filterType").value;
    const region = qs("#filterRegion").value;
    const text = qs("#filterText").value.trim().toLowerCase();

    return state.possibilities.filter(item => {
      if (audience !== "all" && item.audience !== audience) return false;
      if (type !== "all" && item.type !== type) return false;
      if (region !== "all" && item.region_key !== region) return false;
      if (text) {
        const haystack = [item.title, item.location, item.why_interesting, item.notes, ...(item.tags || [])].join(" ").toLowerCase();
        if (!haystack.includes(text)) return false;
      }
      return true;
    });
  }

  function renderPossibilities() {
    const container = qs("#possibilityList");
    const items = filteredPossibilities();
    if (!items.length) {
      emptyState(container, state.possibilities.length ? "No possibilities match these filters." : "Save anything that catches your attention—even if it's only a maybe.");
      return;
    }

    container.innerHTML = items.map(item => {
      const region = regionByKey(item.region_key);
      const mine = state.reactions.find(r => r.possibility_id === item.id && r.user_id === currentUserId());
      const myDef = reactionDefinition(mine?.reaction);
      const reactions = state.reactions.filter(r => r.possibility_id === item.id);
      const reactionChips = reactions.map(r => {
        const def = reactionDefinition(r.reaction);
        return `<span class="member-reaction" title="${escapeHtml(def?.short || "Reaction")}">${escapeHtml(memberName(r.user_id))}: ${escapeHtml(def?.label || r.reaction)}</span>`;
      }).join("");
      const title = escapeHtml(item.title);
      const titleHtml = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : title;
      return `
        <article class="possibility-card" data-possibility="${escapeHtml(item.id)}">
          <div class="card-top">
            <div>
              <span class="type-badge">${escapeHtml(item.type)}</span>
              <span class="audience-badge">${escapeHtml(item.audience)}</span>
            </div>
            <span class="status-badge">${escapeHtml(item.status || "Interesting")}</span>
          </div>
          <h3>${titleHtml}</h3>
          <div class="card-meta">${escapeHtml(item.location || region?.name || "No place attached")} · saved ${escapeHtml(humanDate(item.created_at))}</div>
          ${item.why_interesting ? `<p class="card-why">${escapeHtml(item.why_interesting)}</p>` : ""}
          <div class="tag-row">${(item.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="member-reactions">${reactionChips || `<span class="member-reaction">No reactions yet</span>`}</div>
          <div class="card-actions">
            <div class="reaction-wrap">
              <button class="reaction-button ${mine ? "set" : ""}" data-reaction-toggle="${escapeHtml(item.id)}" type="button">${escapeHtml(myDef?.label || "React")}</button>
              <div class="reaction-menu" data-reaction-menu="${escapeHtml(item.id)}">
                ${CONFIG.reactions.map(r => `<button type="button" data-set-reaction="${escapeHtml(r.key)}" data-id="${escapeHtml(item.id)}">${escapeHtml(r.label)} <small>— ${escapeHtml(r.short)}</small></button>`).join("")}
                ${mine ? `<button type="button" data-clear-reaction="${escapeHtml(item.id)}">Clear reaction</button>` : ""}
              </div>
            </div>
            <button class="delete-mini" data-delete-possibility="${escapeHtml(item.id)}" type="button">Remove</button>
          </div>
        </article>`;
    }).join("");
  }

  async function savePossibilityFromForm() {
    const record = {
      type: qs("#possibilityType").value,
      audience: qs("#possibilityAudience").value,
      title: qs("#possibilityTitle").value.trim(),
      url: normalizeUrl(qs("#possibilityUrl").value),
      region_key: qs("#possibilityRegion").value || null,
      location: qs("#possibilityLocation").value.trim(),
      status: qs("#possibilityStatus").value,
      tags: splitTags(qs("#possibilityTags").value),
      why_interesting: qs("#possibilityWhy").value.trim(),
      notes: qs("#possibilityNotes").value.trim()
    };
    if (!record.title) return;

    const saved = await store.addPossibility(record);
    state.possibilities.unshift(saved);
    if (state.mode === "local") {
      const localData = await store.load();
      state.possibilities = localData.possibilities;
    }
    qs("#possibilityForm").reset();
    qs("#possibilityAudience").value = state.selectedSearchPerson === "Us" ? "Both" : state.selectedSearchPerson;
    qs("#possibilityDialog").close();
    renderAll();
    showToast("Possibility saved.");
  }

  async function deletePossibility(id) {
    const item = state.possibilities.find(x => x.id === id);
    if (!item) return;
    if (!confirm(`Remove “${item.title}” from Elsewhere?`)) return;
    await store.deletePossibility(id);
    state.possibilities = state.possibilities.filter(x => x.id !== id);
    state.reactions = state.reactions.filter(x => x.possibility_id !== id);
    renderAll();
    showToast("Removed.");
  }

  async function setReaction(id, reaction) {
    await store.setReaction(id, reaction);
    const userId = currentUserId();
    state.reactions = state.reactions.filter(r => !(r.possibility_id === id && r.user_id === userId));
    if (reaction) state.reactions.push({ id: uid(), possibility_id: id, user_id: userId, reaction, created_at: new Date().toISOString() });
    closeReactionMenus();
    renderAll();
    showToast(reactionDefinition(reaction)?.label || "Reaction updated.");
  }

  function closeReactionMenus() {
    qsa(".reaction-menu.open").forEach(x => x.classList.remove("open"));
  }

  // ---------------------------------------------------------------------------
  // Places / signals
  // ---------------------------------------------------------------------------

  function regionSignals(regionKey) {
    const items = state.possibilities.filter(p => p.region_key === regionKey);
    const ids = new Set(items.map(x => x.id));
    const reactions = state.reactions.filter(r => ids.has(r.possibility_id));
    const brad = items.filter(x => x.audience === "Brad" || x.audience === "Both").length;
    const sam = items.filter(x => x.audience === "Sam" || x.audience === "Both").length;
    const life = items.filter(x => x.audience === "Both" || ["Place", "Property", "Trip idea"].includes(x.type)).length;
    const positive = reactions.filter(r => POSITIVE_REACTIONS.has(r.reaction)).length;
    const love = reactions.filter(r => r.reaction === "love").length;
    return { items, brad, sam, life, positive, love, weight: items.length + positive * .45 + love * .5 };
  }

  function renderHomeSignals() {
    const container = qs("#homeSignals");
    const ranked = CONFIG.regions
      .map(region => ({ region, signals: regionSignals(region.key) }))
      .filter(x => x.signals.items.length)
      .sort((a,b) => b.signals.weight - a.signals.weight)
      .slice(0,4);

    if (!ranked.length) {
      emptyState(container, "As you save things, Elsewhere will show which places are quietly collecting evidence.");
      return;
    }

    container.innerHTML = ranked.map(({region, signals}) => `
      <article class="signal-card">
        <strong>${escapeHtml(region.name)}</strong>
        <div class="signal-counts">
          <span class="signal-pill">Brad ${signals.brad}</span>
          <span class="signal-pill">Sam ${signals.sam}</span>
          <span class="signal-pill">Life ${signals.life}</span>
          ${signals.positive ? `<span class="signal-pill">Positive ${signals.positive}</span>` : ""}
        </div>
        <p>${escapeHtml(region.note)}</p>
      </article>`).join("");
  }

  function renderPlaces() {
    const container = qs("#placesGrid");
    const rows = CONFIG.regions.map(region => ({ region, signals: regionSignals(region.key) }))
      .sort((a,b) => (b.signals.items.length > 0) - (a.signals.items.length > 0) || b.signals.weight - a.signals.weight || a.region.name.localeCompare(b.region.name));

    container.innerHTML = rows.map(({region, signals}) => `
      <article class="place-card ${signals.items.length >= 3 || signals.positive >= 2 ? "gathering" : ""}">
        <span class="eyebrow">${escapeHtml(region.state)}</span>
        <h3>${escapeHtml(region.name)}</h3>
        <p>${escapeHtml(region.note)}</p>
        <div class="place-counts">
          <div class="place-count"><strong>${signals.brad}</strong><span>Brad</span></div>
          <div class="place-count"><strong>${signals.sam}</strong><span>Sam</span></div>
          <div class="place-count"><strong>${signals.life}</strong><span>Life</span></div>
        </div>
        <div class="place-footer">
          <span>${signals.items.length} saved · ${signals.positive} positive reaction${signals.positive === 1 ? "" : "s"}</span>
          <button class="text-button" data-explore-region="${escapeHtml(region.key)}" type="button">Explore →</button>
        </div>
      </article>`).join("");
  }

  // ---------------------------------------------------------------------------
  // Shared map / pinboard
  // ---------------------------------------------------------------------------

  function mapPinIcon(audience) {
    const tone = audience === "Brad" ? "brad" : audience === "Sam" ? "sam" : "both";
    return window.L.divIcon({
      className: "elsewhere-pin-icon",
      html: `<div class="pushpin ${tone}"><span class="pushpin-head">✦</span><span class="pushpin-needle"></span></div>`,
      iconSize: [38, 48],
      iconAnchor: [19, 46],
      popupAnchor: [0, -42]
    });
  }

  function pinPopupHtml(pin) {
    const region = regionByKey(pin.region_key);
    return `
      <div class="map-popup">
        <strong>${escapeHtml(pin.title)}</strong>
        <span>${escapeHtml(pin.audience)}${region ? ` · ${escapeHtml(region.name)}` : ""}</span>
        ${pin.notes ? `<p>${escapeHtml(pin.notes)}</p>` : ""}
        <small>Pinned by ${escapeHtml(memberName(pin.created_by))}</small>
        <button class="delete-mini" data-delete-map-pin="${escapeHtml(pin.id)}" type="button">Remove pin</button>
      </div>`;
  }

  function ensureMap() {
    const container = qs("#elsewhereMap");
    if (!container || !window.L) {
      if (container) container.innerHTML = `<div class="map-unavailable">The map library didn't load. Refresh the page and try again.</div>`;
      return;
    }

    if (!elsewhereMap) {
      elsewhereMap = window.L.map("elsewhereMap", { zoomControl: true, zoomSnap: .5 }).setView([43.35, -73.4], 5);
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(elsewhereMap);
      mapPinLayer = window.L.layerGroup().addTo(elsewhereMap);
      elsewhereMap.on("click", event => openMapPinDialog(event.latlng));
    }

    requestAnimationFrame(() => elsewhereMap.invalidateSize());
    renderMapPins();
  }

  function openMapPinDialog(latlng) {
    qs("#mapPinForm").reset();
    qs("#mapPinLatitude").value = latlng.lat.toFixed(6);
    qs("#mapPinLongitude").value = latlng.lng.toFixed(6);
    qs("#mapPinCoordinates").textContent = `${latlng.lat.toFixed(3)}, ${latlng.lng.toFixed(3)}`;
    qs("#mapPinAudience").value = "Both";
    const selectedRegion = state.selectedRegionKey && state.selectedRegionKey !== "new-england" ? state.selectedRegionKey : "";
    qs("#mapPinRegion").value = selectedRegion;
    qs("#mapPinDialog").showModal();
    setTimeout(() => qs("#mapPinTitle").focus(), 0);
  }

  async function saveMapPinFromForm() {
    const record = {
      title: qs("#mapPinTitle").value.trim(),
      audience: qs("#mapPinAudience").value,
      region_key: qs("#mapPinRegion").value || null,
      notes: qs("#mapPinNotes").value.trim(),
      latitude: Number(qs("#mapPinLatitude").value),
      longitude: Number(qs("#mapPinLongitude").value)
    };
    if (!record.title || !Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) return;

    const saved = await store.addMapPin(record);
    state.mapPins.unshift(saved);
    if (state.mode === "local") state.mapPins = (await store.load()).map_pins || [];
    qs("#mapPinDialog").close();
    renderMapPins();
    showToast("Pin dropped.");
  }

  async function deleteMapPin(id) {
    const pin = state.mapPins.find(x => x.id === id);
    if (!pin) return;
    if (!confirm(`Remove the pin for “${pin.title}”?`)) return;
    await store.deleteMapPin(id);
    state.mapPins = state.mapPins.filter(x => x.id !== id);
    renderMapPins();
    showToast("Pin removed.");
  }

  function focusMapPin(id) {
    const pin = state.mapPins.find(x => x.id === id);
    if (!pin) return;
    navigate("map", false);
    ensureMap();
    elsewhereMap.setView([Number(pin.latitude), Number(pin.longitude)], Math.max(elsewhereMap.getZoom(), 8));
    const marker = mapMarkers.get(id);
    if (marker) marker.openPopup();
  }

  function renderMapPins() {
    const list = qs("#mapPinList");
    const count = qs("#mapPinCount");
    if (count) count.textContent = `${state.mapPins.length} pin${state.mapPins.length === 1 ? "" : "s"}`;

    if (list) {
      if (!state.mapPins.length) {
        emptyState(list, "The board is blank on purpose. Click the map when somewhere makes either of you curious.");
      } else {
        list.innerHTML = state.mapPins.map(pin => {
          const region = regionByKey(pin.region_key);
          return `
            <article class="map-pin-item">
              <button class="map-pin-focus" data-map-pin-focus="${escapeHtml(pin.id)}" type="button">
                <span class="map-pin-dot ${pin.audience === "Brad" ? "brad" : pin.audience === "Sam" ? "sam" : "both"}"></span>
                <span><strong>${escapeHtml(pin.title)}</strong><small>${escapeHtml(pin.audience)}${region ? ` · ${escapeHtml(region.name)}` : ""}</small></span>
              </button>
              <button class="delete-mini" data-delete-map-pin="${escapeHtml(pin.id)}" type="button">Remove</button>
            </article>`;
        }).join("");
      }
    }

    if (!elsewhereMap || !mapPinLayer) return;
    mapPinLayer.clearLayers();
    mapMarkers.clear();
    state.mapPins.forEach(pin => {
      const lat = Number(pin.latitude);
      const lng = Number(pin.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = window.L.marker([lat, lng], { icon: mapPinIcon(pin.audience), title: pin.title })
        .bindPopup(pinPopupHtml(pin), { maxWidth: 280 })
        .addTo(mapPinLayer);
      mapMarkers.set(pin.id, marker);
    });
  }

  // ---------------------------------------------------------------------------
  // Observations
  // ---------------------------------------------------------------------------

  function renderObservations() {
    const container = qs("#observationList");
    if (!state.observations.length) {
      emptyState(container, "Capture the things you don't want to lose: patterns, questions, surprises, and recurring themes.");
      return;
    }
    container.innerHTML = state.observations.map(note => {
      const region = regionByKey(note.region_key);
      return `
        <article class="note-card">
          <p>${escapeHtml(note.body)}</p>
          <div class="note-tags">${(note.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="note-meta">
            <span>${escapeHtml(memberName(note.author_id))}${region ? ` · ${escapeHtml(region.name)}` : ""} · ${escapeHtml(humanDate(note.created_at))}</span>
            <button class="delete-mini" data-delete-observation="${escapeHtml(note.id)}" type="button">Remove</button>
          </div>
        </article>`;
    }).join("");
  }

  async function addObservation() {
    const body = qs("#observationBody").value.trim();
    if (!body) return;
    const saved = await store.addObservation({
      body,
      region_key: qs("#observationRegion").value || null,
      tags: splitTags(qs("#observationTags").value)
    });
    state.observations.unshift(saved);
    if (state.mode === "local") state.observations = (await store.load()).observations;
    qs("#observationBody").value = "";
    qs("#observationRegion").value = "";
    qs("#observationTags").value = "";
    renderAll();
    showToast("Note added.");
  }

  async function deleteObservation(id) {
    await store.deleteObservation(id);
    state.observations = state.observations.filter(x => x.id !== id);
    renderAll();
    showToast("Note removed.");
  }

  // ---------------------------------------------------------------------------
  // Home, workspace, exports
  // ---------------------------------------------------------------------------

  function renderHome() {
    renderHomeSignals();
    const recent = qs("#homeRecent");
    if (!state.possibilities.length) {
      emptyState(recent, "A job, town, cemetery, house, company, trail—save the first thing that makes either of you curious.");
    } else {
      recent.innerHTML = state.possibilities.slice(0,4).map(p => `<div class="compact-item"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.audience)} · ${escapeHtml(p.type)}${p.region_key ? ` · ${escapeHtml(regionByKey(p.region_key)?.name || "")}` : ""}</small></div>`).join("");
    }

    const learning = qs("#homeLearning");
    if (!state.observations.length) {
      emptyState(learning, "The notebook starts empty. That's a feature, not a problem.");
    } else {
      learning.innerHTML = state.observations.slice(0,3).map(n => `<div class="compact-item"><strong>${escapeHtml(n.body.length > 92 ? `${n.body.slice(0,92)}…` : n.body)}</strong><small>${escapeHtml(memberName(n.author_id))} · ${escapeHtml(humanDate(n.created_at))}</small></div>`).join("");
    }
  }

  function updateModeUI(starting = false) {
    const shared = state.mode === "shared";
    qs("#modeDot").classList.toggle("shared", shared && Boolean(state.user));
    qs("#modeLabel").textContent = starting ? "Connecting…" : shared ? (state.user ? "Shared workspace" : "Sign in required") : "Local preview";
    qs("#modeHint").textContent = shared ? (state.user ? "Supabase connected" : "Brad + Sam") : "Supabase not configured";
    qs("#signOutBtn").classList.toggle("hidden", !(shared && state.user));
    qs("#localPersonWrap").classList.toggle("hidden", shared);
    qs("#localResetPanel").classList.toggle("hidden", shared);
    qs("#localPersonSelect").value = state.localPerson;

    const name = currentPersonName();
    qs("#identityName").textContent = name;
    qs("#identityAvatar").textContent = (name || "?").slice(0,1).toUpperCase();
    qs("#identityDetail").textContent = shared ? "Shared Elsewhere" : "Local preview";
    qs("#workspaceName").textContent = state.workspace?.name || "Elsewhere";
  }

  function renderWorkspace() {
    const container = qs("#workspaceDetails");
    if (state.mode === "local") {
      container.innerHTML = `<p>Local preview mode stores everything in this browser. Add your Supabase URL and publishable key in <code>config.js</code> to switch on shared mode.</p>`;
      return;
    }
    if (!state.workspace) {
      container.innerHTML = `<p>Sign in and create or join the workspace first.</p>`;
      return;
    }
    container.innerHTML = `
      <p>Use this code once when the second person joins:</p>
      <div class="workspace-code">${escapeHtml(state.workspace.join_code || "—")}</div>
      <div class="member-list">
        ${state.members.map(m => `<div class="member-row"><span class="member-mini-avatar">${escapeHtml((m.display_name || "?").slice(0,1).toUpperCase())}</span><span>${escapeHtml(m.display_name)} · ${escapeHtml(m.role)}</span></div>`).join("")}
      </div>`;
  }

  function exportPayload() {
    return {
      app: "Elsewhere",
      version: 1,
      exported_at: new Date().toISOString(),
      workspace: state.workspace ? { id: state.workspace.id, name: state.workspace.name } : null,
      members: state.members.map(m => ({ user_id: m.user_id, display_name: m.display_name, role: m.role })),
      possibilities: state.possibilities,
      reactions: state.reactions,
      observations: state.observations,
      map_pins: state.mapPins
    };
  }

  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function datedFilename(ext) {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    return `elsewhere_${stamp}.${ext}`;
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const rows = [["type","audience","title","url","region","location","status","why_interesting","notes","tags","saved_at"]];
    state.possibilities.forEach(p => rows.push([
      p.type, p.audience, p.title, p.url || "", regionByKey(p.region_key)?.name || "", p.location || "", p.status || "",
      p.why_interesting || "", p.notes || "", (p.tags || []).join("; "), p.created_at || ""
    ]));
    download(datedFilename("csv"), rows.map(row => row.map(csvEscape).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  function renderAll() {
    updateModeUI();
    renderHome();
    renderPossibilities();
    renderPlaces();
    renderMapPins();
    renderObservations();
    renderWorkspace();
    renderLensCards();
  }

  // ---------------------------------------------------------------------------
  // Auth / workspace onboarding
  // ---------------------------------------------------------------------------

  function setAuthMode(mode) {
    state.authMode = mode;
    qsa(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.authMode === mode));
    qs("#authNameWrap").classList.toggle("hidden", mode !== "signup");
    qs("#authName").required = mode === "signup";
    qs("#authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
    qs("#authSubmit").textContent = mode === "signup" ? "Create account" : "Sign in";
    qs("#authMessage").textContent = "";
  }

  async function submitAuth(event) {
    event.preventDefault();
    const email = qs("#authEmail").value.trim();
    const password = qs("#authPassword").value;
    const name = qs("#authName").value.trim();
    const message = qs("#authMessage");
    message.className = "form-message";
    message.textContent = "Working…";

    try {
      if (state.authMode === "signup") {
        const { data, error } = await store.signUp(name, email, password);
        if (error) throw error;
        if (data.session) {
          await acceptSession(data.session);
          renderAll();
        } else {
          message.classList.add("success");
          message.textContent = "Account created. Check your email to confirm it, then come back and sign in.";
        }
      } else {
        const { data, error } = await store.signIn(email, password);
        if (error) throw error;
        await acceptSession(data.session);
        renderAll();
      }
    } catch (error) {
      console.error(error);
      message.classList.add("error");
      message.textContent = error.message || "Couldn't sign in.";
    }
  }

  async function createWorkspace() {
    const message = qs("#workspaceMessage");
    message.textContent = "Creating…";
    try {
      await store.createWorkspace();
      const context = await store.getWorkspaceContext(state.user.id);
      state.workspace = context.workspace;
      await loadSharedData();
      qs("#workspaceDialog").close();
      renderAll();
      showToast("Elsewhere is shared now.");
    } catch (error) {
      console.error(error);
      message.className = "form-message error";
      message.textContent = error.message;
    }
  }

  async function joinWorkspace() {
    const code = qs("#joinCodeInput").value.trim();
    const message = qs("#workspaceMessage");
    if (!code) return;
    message.textContent = "Joining…";
    try {
      await store.joinWorkspace(code);
      const context = await store.getWorkspaceContext(state.user.id);
      if (!context) throw new Error("That code didn't open a workspace.");
      state.workspace = context.workspace;
      await loadSharedData();
      qs("#workspaceDialog").close();
      renderAll();
      showToast("Joined Elsewhere.");
    } catch (error) {
      console.error(error);
      message.className = "form-message error";
      message.textContent = error.message;
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function wireEvents() {
    document.addEventListener("click", async event => {
      const nav = event.target.closest("[data-view]");
      if (nav) { navigate(nav.dataset.view); return; }

      const jump = event.target.closest("[data-jump]");
      if (jump) { navigate(jump.dataset.jump); return; }

      const person = event.target.closest("[data-explore-person]");
      if (person) { startExplore(person.dataset.explorePerson); return; }

      const lens = event.target.closest("[data-lens]");
      if (lens) {
        qs("#searchLens").value = lens.dataset.lens;
        state.selectedLensKey = lens.dataset.lens;
        buildSearches();
        return;
      }

      const region = event.target.closest("[data-explore-region]");
      if (region) {
        qs("#searchRegion").value = region.dataset.exploreRegion;
        buildSearches();
        navigate("explore");
        return;
      }

      const reactionToggle = event.target.closest("[data-reaction-toggle]");
      if (reactionToggle) {
        const menu = qs(`[data-reaction-menu="${CSS.escape(reactionToggle.dataset.reactionToggle)}"]`);
        const opening = !menu.classList.contains("open");
        closeReactionMenus();
        if (opening) menu.classList.add("open");
        return;
      }

      const reaction = event.target.closest("[data-set-reaction]");
      if (reaction) { await setReaction(reaction.dataset.id, reaction.dataset.setReaction); return; }

      const clearReaction = event.target.closest("[data-clear-reaction]");
      if (clearReaction) { await setReaction(clearReaction.dataset.clearReaction, null); return; }

      const deleteP = event.target.closest("[data-delete-possibility]");
      if (deleteP) { await deletePossibility(deleteP.dataset.deletePossibility); return; }

      const deleteO = event.target.closest("[data-delete-observation]");
      if (deleteO) { await deleteObservation(deleteO.dataset.deleteObservation); return; }

      const focusPin = event.target.closest("[data-map-pin-focus]");
      if (focusPin) { focusMapPin(focusPin.dataset.mapPinFocus); return; }

      const deletePin = event.target.closest("[data-delete-map-pin]");
      if (deletePin) { await deleteMapPin(deletePin.dataset.deleteMapPin); return; }

      if (!event.target.closest(".reaction-wrap")) closeReactionMenus();
    });

    qs("#searchPerson").addEventListener("change", () => { updateLensSelect(); buildSearches(); });
    qs("#searchLens").addEventListener("change", () => { state.selectedLensKey = qs("#searchLens").value; buildSearches(); });
    qs("#searchRegion").addEventListener("change", buildSearches);
    qs("#buildSearchBtn").addEventListener("click", buildSearches);
    qs("#randomThreadBtn").addEventListener("click", randomThread);
    qs("#randomThreadHome").addEventListener("click", randomThread);
    qs("#followThreadBtn").addEventListener("click", randomThread);

    qs("#openAddPossibility").addEventListener("click", () => {
      qs("#possibilityAudience").value = state.selectedSearchPerson === "Us" ? "Both" : state.selectedSearchPerson;
      qs("#possibilityRegion").value = state.selectedRegionKey || "";
      qs("#possibilityDialog").showModal();
    });

    qs("#possibilityForm").addEventListener("submit", async event => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      try { await savePossibilityFromForm(); }
      catch (error) { console.error(error); showToast(error.message || "Couldn't save that possibility."); }
    });

    ["#filterAudience", "#filterType", "#filterRegion"].forEach(id => qs(id).addEventListener("change", renderPossibilities));
    qs("#filterText").addEventListener("input", renderPossibilities);

    qs("#addObservation").addEventListener("click", async () => {
      try { await addObservation(); }
      catch (error) { console.error(error); showToast(error.message || "Couldn't add the note."); }
    });

    qs("#mapPinForm").addEventListener("submit", async event => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      try { await saveMapPinFromForm(); }
      catch (error) { console.error(error); showToast(error.message || "Couldn't save that pin."); }
    });

    qs("#localPersonSelect").addEventListener("change", event => {
      state.localPerson = event.target.value;
      localStorage.setItem(LOCAL_PERSON_KEY, state.localPerson);
      updateModeUI();
      renderAll();
    });

    qs("#exportJson").addEventListener("click", () => download(datedFilename("json"), JSON.stringify(exportPayload(), null, 2), "application/json"));
    qs("#exportCsv").addEventListener("click", exportCsv);
    qs("#resetLocal").addEventListener("click", async () => {
      if (!confirm("Reset this browser's local Elsewhere preview?")) return;
      const data = await store.reset();
      Object.assign(state, { workspace: data.workspace, members: data.members, possibilities: data.possibilities, reactions: data.reactions, observations: data.observations, mapPins: data.map_pins || [] });
      renderAll();
      showToast("Local preview reset.");
    });

    qsa(".auth-tab").forEach(tab => tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode)));
    qs("#authForm").addEventListener("submit", submitAuth);
    qs("#createWorkspaceBtn").addEventListener("click", createWorkspace);
    qs("#joinWorkspaceBtn").addEventListener("click", joinWorkspace);
    qs("#signOutBtn").addEventListener("click", async () => { await store.signOut(); });

    [qs("#authDialog"), qs("#workspaceDialog")].forEach(dialog => dialog.addEventListener("cancel", event => event.preventDefault()));
  }

  init().catch(error => {
    console.error(error);
    showToast("Elsewhere hit a startup problem. Check the console and setup notes.");
  });
})();
