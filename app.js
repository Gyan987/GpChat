import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://kvjlbzjhepezyktycbcm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2amxiempoZXBlenlrdHljYmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NDU0NzMsImV4cCI6MjA4MjUyMTQ3M30.hdOTo-HTZwRtm3nbogjovJmguU_z20P2VCpU_J3Be-Q";

export const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEYS = {
	theme: "gpchat_theme",
	sound: "gpchat_sound",
	draft: "gpchat_draft",
	pinnedByRoom: "gpchat_pinned_by_room",
	room: "gpchat_room",
};

const ROOM_LABELS = {
	global: "Global Lounge",
	dev: "Dev Lounge",
	random: "Random Lounge",
};

const pathname = window.location.pathname.toLowerCase();
const isLoginPage = pathname.endsWith("login.html") || pathname.endsWith("/") || pathname.endsWith("index.html");
const isChatPage = pathname.endsWith("chat.html");

if (isLoginPage) {
	initializeLoginPage();
}

if (isChatPage) {
	initializeChatPage();
}

applyStoredTheme();

function setStatus(element, text, isError = false) {
	if (!element) {
		return;
	}

	element.textContent = text;
	element.classList.toggle("status-error", isError);
}

function safeStorageGet(key, fallbackValue) {
	try {
		const value = localStorage.getItem(key);
		return value ?? fallbackValue;
	} catch {
		return fallbackValue;
	}
}

function safeStorageSet(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Ignore storage write failures.
	}
}

function safeStorageRemove(key) {
	try {
		localStorage.removeItem(key);
	} catch {
		// Ignore storage remove failures.
	}
}

function applyStoredTheme() {
	const theme = safeStorageGet(STORAGE_KEYS.theme, "sunrise");
	applyTheme(theme);
}

function applyTheme(theme) {
	const normalizedTheme = theme === "noir" ? "noir" : "sunrise";
	document.body.classList.toggle("theme-noir", normalizedTheme === "noir");
	safeStorageSet(STORAGE_KEYS.theme, normalizedTheme);
}

function getShortNameFromEmail(email) {
	if (!email || !email.includes("@")) {
		return "User";
	}

	return email.split("@")[0];
}

function getAvatarLetter(email) {
	const shortName = getShortNameFromEmail(email);
	return shortName.charAt(0).toUpperCase() || "U";
}

async function initializeLoginPage() {
	const emailInput = document.getElementById("email");
	const passwordInput = document.getElementById("password");
	const loginBtn = document.getElementById("loginBtn");
	const signupBtn = document.getElementById("signupBtn");
	const authStatus = document.getElementById("authStatus");
	const authForm = document.getElementById("authForm");

	if (!emailInput || !passwordInput || !loginBtn || !signupBtn || !authForm) {
		return;
	}

	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (session?.user) {
		window.location.href = "chat.html";
		return;
	}

	const setLoading = (loading) => {
		loginBtn.disabled = loading;
		signupBtn.disabled = loading;
	};

	const readCredentials = () => {
		const email = emailInput.value.trim().toLowerCase();
		const password = passwordInput.value;
		return { email, password };
	};

	const handleLogin = async () => {
		const { email, password } = readCredentials();
		if (!email || !password) {
			setStatus(authStatus, "Please provide both email and password.", true);
			return;
		}

		setLoading(true);
		setStatus(authStatus, "Signing you in...");

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			setStatus(authStatus, error.message, true);
			setLoading(false);
			return;
		}

		setStatus(authStatus, "Success. Redirecting...");
		window.location.href = "chat.html";
	};

	const handleSignup = async () => {
		const { email, password } = readCredentials();
		if (!email || !password) {
			setStatus(authStatus, "Please provide both email and password.", true);
			return;
		}

		if (password.length < 6) {
			setStatus(authStatus, "Password should be at least 6 characters.", true);
			return;
		}

		setLoading(true);
		setStatus(authStatus, "Creating your account...");

		const { error } = await supabase.auth.signUp({ email, password });
		if (error) {
			setStatus(authStatus, error.message, true);
			setLoading(false);
			return;
		}

		setStatus(authStatus, "Account created. Check your email if confirmation is enabled.");
		setLoading(false);
	};

	authForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		await handleLogin();
	});

	loginBtn.addEventListener("click", handleLogin);
	signupBtn.addEventListener("click", handleSignup);
}

async function initializeChatPage() {
	const chatBox = document.getElementById("chat-box");
	const msgInput = document.getElementById("msg");
	const composerForm = document.getElementById("composerForm");
	const searchInput = document.getElementById("searchInput");
	const mineOnlyToggle = document.getElementById("mineOnlyToggle");
	const themeToggleBtn = document.getElementById("themeToggleBtn");
	const soundToggleBtn = document.getElementById("soundToggleBtn");
	const jumpBottomBtn = document.getElementById("jumpBottomBtn");
	const emptyFeedHint = document.getElementById("emptyFeedHint");
	const pinBoard = document.getElementById("pinBoard");
	const messageStats = document.getElementById("messageStats");
	const charCounter = document.getElementById("charCounter");
	const liveStatus = document.getElementById("liveStatus");
	const typingStatus = document.getElementById("typingStatus");
	const profileEmail = document.getElementById("profileEmail");
	const avatarBadge = document.getElementById("avatarBadge");
	const clearLocalViewBtn = document.getElementById("clearLocalViewBtn");
	const logoutBtn = document.getElementById("logoutBtn");
	const roomList = document.getElementById("roomList");
	const activeRoomLabel = document.getElementById("activeRoomLabel");
	const chatRoomHeading = document.getElementById("chatRoomHeading");

	if (!chatBox || !msgInput || !composerForm || !roomList) {
		return;
	}

	const {
		data: { session },
	} = await supabase.auth.getSession();

	const currentUser = session?.user;
	if (!currentUser) {
		window.location.href = "login.html";
		return;
	}

	profileEmail.textContent = currentUser.email;
	avatarBadge.textContent = getAvatarLetter(currentUser.email);
	setStatus(liveStatus, "Loading latest messages...");

	let currentRoom = normalizeRoom(safeStorageGet(STORAGE_KEYS.room, "global"));
	msgInput.value = safeStorageGet(getDraftStorageKey(currentRoom), "");
	autoGrowTextarea(msgInput);
	updateCharCounter(msgInput, charCounter);

	let supportsRoomColumn = true;
	let supportsMessageLifecycleColumns = true;
	let soundEnabled = safeStorageGet(STORAGE_KEYS.sound, "on") !== "off";
	let unreadCount = 0;
	let audioContext;
	let currentTheme = safeStorageGet(STORAGE_KEYS.theme, "sunrise") === "noir" ? "noir" : "sunrise";
	let typingDebounceId;
	let typingClearId;
	const remoteTypingMap = new Map();

	const renderedMessageIds = new Set();
	const messageDataById = new Map();
	const messageElementsById = new Map();
	const pinnedByRoom = getPinnedByRoom();
	const chatTitleBase = "GpChat | Chat";

	themeToggleBtn.textContent = currentTheme === "noir" ? "Sunrise" : "Noir";
	soundToggleBtn.textContent = soundEnabled ? "Sound On" : "Sound Off";

	const roomState = {
		current: currentRoom,
		get pinnedIds() {
			return new Set(pinnedByRoom[roomState.current] || []);
		},
		set pinnedIds(setValue) {
			pinnedByRoom[roomState.current] = Array.from(setValue);
			savePinnedByRoom(pinnedByRoom);
		},
	};

	const refreshDocumentTitle = () => {
		document.title = unreadCount > 0 ? `(${unreadCount}) ${chatTitleBase}` : chatTitleBase;
	};

	const updateTypingStatus = () => {
		const activeUsers = Array.from(remoteTypingMap.entries())
			.filter(([, expiresAt]) => expiresAt > Date.now())
			.map(([email]) => getShortNameFromEmail(email));

		if (!activeUsers.length) {
			typingStatus.textContent = "";
			return;
		}

		if (activeUsers.length === 1) {
			typingStatus.textContent = `${activeUsers[0]} is typing...`;
			return;
		}

		typingStatus.textContent = `${activeUsers.length} people are typing...`;
	};

	const updateStats = () => {
		const totalInRoom = Array.from(messageDataById.values()).filter((msg) => isMessageInCurrentRoom(msg, roomState.current, supportsRoomColumn)).length;
		const visible = Array.from(messageElementsById.values()).filter((item) => !item.classList.contains("is-hidden")).length;
		messageStats.textContent = `${visible} visible of ${totalInRoom} messages`;
		emptyFeedHint.classList.toggle("show", totalInRoom > 0 && visible === 0);
	};

	const applyFilters = () => {
		const query = (searchInput.value || "").trim().toLowerCase();
		const mineOnly = mineOnlyToggle.checked;

		messageElementsById.forEach((el, id) => {
			const message = messageDataById.get(id);
			if (!message) {
				return;
			}

			const roomMatch = isMessageInCurrentRoom(message, roomState.current, supportsRoomColumn);
			const mineMatch = !mineOnly || message.user_email === currentUser.email;
			const querySource = `${message.message} ${message.user_email}`.toLowerCase();
			const queryMatch = !query || querySource.includes(query);

			el.classList.toggle("is-hidden", !(roomMatch && mineMatch && queryMatch));
		});

		updateStats();
	};

	const savePinnedIds = (pinnedIds) => {
		roomState.pinnedIds = pinnedIds;
	};

	const renderPinnedBoard = () => {
		pinBoard.innerHTML = "";
		const pinnedIds = roomState.pinnedIds;

		if (!pinnedIds.size) {
			const placeholder = document.createElement("p");
			placeholder.className = "panel-empty";
			placeholder.textContent = "Pin any message to keep it here.";
			pinBoard.appendChild(placeholder);
			return;
		}

		Array.from(pinnedIds)
			.reverse()
			.forEach((id) => {
				const pinnedMessage = messageDataById.get(id);
				if (!pinnedMessage || !isMessageInCurrentRoom(pinnedMessage, roomState.current, supportsRoomColumn)) {
					return;
				}

				const card = document.createElement("article");
				card.className = "pin-card";

				const title = document.createElement("p");
				title.className = "pin-title";
				title.textContent = getShortNameFromEmail(pinnedMessage.user_email);

				const body = document.createElement("p");
				body.className = "pin-body";
				body.textContent = truncateText(getMessageDisplayText(pinnedMessage), 72);

				card.appendChild(title);
				card.appendChild(body);
				card.addEventListener("click", () => {
					const target = messageElementsById.get(id);
					if (!target || target.classList.contains("is-hidden")) {
						return;
					}
					target.scrollIntoView({ behavior: "smooth", block: "center" });
					target.classList.add("focus-pulse");
					setTimeout(() => target.classList.remove("focus-pulse"), 1200);
				});

				pinBoard.appendChild(card);
			});
	};

	const togglePin = (id) => {
		const pinnedIds = roomState.pinnedIds;
		if (pinnedIds.has(id)) {
			pinnedIds.delete(id);
		} else {
			pinnedIds.add(id);
		}

		savePinnedIds(pinnedIds);
		renderPinnedBoard();

		const messageEl = messageElementsById.get(id);
		if (messageEl) {
			messageEl.classList.toggle("is-pinned", pinnedIds.has(id));
			const pinButton = messageEl.querySelector("[data-action='pin']");
			if (pinButton) {
				pinButton.textContent = pinnedIds.has(id) ? "Unpin" : "Pin";
			}
		}
	};

	const updateMessageElement = (element, data) => {
		element.classList.toggle("mine", data.user_email === currentUser.email);
		element.classList.toggle("is-deleted", !!data.is_deleted);

		const sender = element.querySelector(".msg-sender");
		if (sender) {
			sender.textContent = data.user_email === currentUser.email ? "You" : getShortNameFromEmail(data.user_email);
		}

		const body = element.querySelector(".msg-body");
		if (body) {
			body.innerHTML = "";
			setMessageBody(body, getMessageDisplayText(data));
		}

		const ts = element.querySelector(".msg-time");
		if (ts) {
			const editedLabel = data.updated_at ? " (edited)" : "";
			ts.textContent = `${formatTime(data.created_at)}${editedLabel}`;
		}

		const editButton = element.querySelector("[data-action='edit']");
		const deleteButton = element.querySelector("[data-action='delete']");
		if (editButton) {
			editButton.disabled = data.user_email !== currentUser.email || !!data.is_deleted;
		}
		if (deleteButton) {
			deleteButton.disabled = data.user_email !== currentUser.email || !!data.is_deleted;
		}
	};

	const appendOrUpdateMessage = (rawData) => {
		const normalized = normalizeMessage(rawData, supportsRoomColumn);
		const messageId = normalized.id;
		if (!messageId) {
			return;
		}

		const existingEl = messageElementsById.get(messageId);
		if (existingEl) {
			messageDataById.set(messageId, normalized);
			updateMessageElement(existingEl, normalized);
			applyFilters();
			renderPinnedBoard();
			return;
		}

		renderedMessageIds.add(messageId);
		messageDataById.set(messageId, normalized);

		const isMine = normalized.user_email === currentUser.email;
		const item = document.createElement("article");
		item.className = `msg-item ${isMine ? "mine" : ""}`;
		item.dataset.messageId = messageId;

		const sender = document.createElement("p");
		sender.className = "msg-sender";

		const body = document.createElement("p");
		body.className = "msg-body";

		const actionRow = document.createElement("div");
		actionRow.className = "msg-actions";

		const pinButton = document.createElement("button");
		pinButton.type = "button";
		pinButton.className = "msg-action";
		pinButton.dataset.action = "pin";
		pinButton.textContent = roomState.pinnedIds.has(messageId) ? "Unpin" : "Pin";

		const copyButton = document.createElement("button");
		copyButton.type = "button";
		copyButton.className = "msg-action";
		copyButton.dataset.action = "copy";
		copyButton.textContent = "Copy";

		const editButton = document.createElement("button");
		editButton.type = "button";
		editButton.className = "msg-action";
		editButton.dataset.action = "edit";
		editButton.textContent = "Edit";

		const deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.className = "msg-action";
		deleteButton.dataset.action = "delete";
		deleteButton.textContent = "Delete";

		actionRow.appendChild(pinButton);
		actionRow.appendChild(copyButton);
		actionRow.appendChild(editButton);
		actionRow.appendChild(deleteButton);

		const ts = document.createElement("time");
		ts.className = "msg-time";

		item.appendChild(sender);
		item.appendChild(body);
		item.appendChild(actionRow);
		item.appendChild(ts);
		chatBox.appendChild(item);

		if (roomState.pinnedIds.has(messageId)) {
			item.classList.add("is-pinned");
		}

		item.addEventListener("click", async (event) => {
			const actionButton = event.target.closest(".msg-action");
			if (!actionButton) {
				return;
			}

			if (actionButton.dataset.action === "pin") {
				togglePin(messageId);
				return;
			}

			if (actionButton.dataset.action === "copy") {
				await copyText(getMessageDisplayText(messageDataById.get(messageId)));
				setStatus(liveStatus, "Message copied to clipboard.");
				return;
			}

			if (actionButton.dataset.action === "edit") {
				await handleEditMessage(messageId);
				return;
			}

			if (actionButton.dataset.action === "delete") {
				await handleDeleteMessage(messageId);
			}
		});

		messageElementsById.set(messageId, item);
		updateMessageElement(item, normalized);
		applyFilters();
		renderPinnedBoard();

		if (isNearBottom(chatBox)) {
			chatBox.scrollTop = chatBox.scrollHeight;
		}

		if (normalized.user_email !== currentUser.email) {
			if (document.hidden) {
				unreadCount += 1;
				refreshDocumentTitle();
				notifyIncomingMessage(normalized);
			}
			playIncomingTone();
		}
	};

	const clearMessageCollection = () => {
		chatBox.querySelectorAll(".msg-item").forEach((item) => item.remove());
		renderedMessageIds.clear();
		messageDataById.clear();
		messageElementsById.clear();
	};

	const loadMessages = async () => {
		setStatus(liveStatus, `Loading ${ROOM_LABELS[roomState.current]}...`);
		clearMessageCollection();

		let rows = [];
		const room = roomState.current;

		try {
			let query = supabase
				.from("messages")
				.select("id, user_email, message, created_at, updated_at, is_deleted, room")
				.order("created_at", { ascending: true })
				.limit(400);
			query = query.eq("room", room);
			const { data, error } = await query;

			if (error) {
				throw error;
			}

			rows = data || [];
			supportsRoomColumn = true;
			supportsMessageLifecycleColumns = true;
		} catch (firstError) {
			const message = String(firstError?.message || "").toLowerCase();
			supportsRoomColumn = !message.includes("room");
			supportsMessageLifecycleColumns = !message.includes("updated_at") && !message.includes("is_deleted");

			try {
				let query = supabase
					.from("messages")
					.select("id, user_email, message, created_at")
					.order("created_at", { ascending: true })
					.limit(400);
				if (supportsRoomColumn) {
					query = query.eq("room", room);
				}
				const { data, error } = await query;
				if (error) {
					throw error;
				}
				rows = data || [];
			} catch {
				setStatus(liveStatus, "Unable to load chat history.", true);
				applyFilters();
				renderPinnedBoard();
				return;
			}
		}

		rows.forEach(appendOrUpdateMessage);
		applyFilters();
		renderPinnedBoard();

		if (supportsRoomColumn) {
			setStatus(liveStatus, `Connected to ${ROOM_LABELS[roomState.current]}. Live updates enabled.`);
		} else {
			setStatus(liveStatus, "Connected in compatibility mode (single room table).", false);
		}
	};

	const handleEditMessage = async (messageId) => {
		const original = messageDataById.get(messageId);
		if (!original || original.user_email !== currentUser.email || original.is_deleted) {
			return;
		}

		const edited = window.prompt("Edit your message", original.message);
		if (edited === null) {
			return;
		}

		const trimmed = edited.trim();
		if (!trimmed) {
			setStatus(liveStatus, "Edited message cannot be empty.", true);
			return;
		}

		setStatus(liveStatus, "Updating message...");
		const payload = supportsMessageLifecycleColumns
			? { message: trimmed, updated_at: new Date().toISOString() }
			: { message: trimmed };

		const { error } = await supabase.from("messages").update(payload).eq("id", messageId).eq("user_email", currentUser.email);
		if (error) {
			setStatus(liveStatus, `Edit failed: ${error.message}`, true);
			return;
		}

		appendOrUpdateMessage({ ...original, ...payload });
		setStatus(liveStatus, "Message updated.");
	};

	const handleDeleteMessage = async (messageId) => {
		const original = messageDataById.get(messageId);
		if (!original || original.user_email !== currentUser.email || original.is_deleted) {
			return;
		}

		if (!window.confirm("Delete this message?")) {
			return;
		}

		setStatus(liveStatus, "Deleting message...");

		if (supportsMessageLifecycleColumns) {
			const { error } = await supabase
				.from("messages")
				.update({
					message: "[deleted]",
					is_deleted: true,
					updated_at: new Date().toISOString(),
				})
				.eq("id", messageId)
				.eq("user_email", currentUser.email);

			if (!error) {
				appendOrUpdateMessage({ ...original, message: "[deleted]", is_deleted: true, updated_at: new Date().toISOString() });
				setStatus(liveStatus, "Message deleted.");
				return;
			}
		}

		const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("user_email", currentUser.email);
		if (error) {
			setStatus(liveStatus, `Delete failed: ${error.message}`, true);
			return;
		}

		const element = messageElementsById.get(messageId);
		if (element) {
			element.remove();
		}
		messageElementsById.delete(messageId);
		messageDataById.delete(messageId);
		renderedMessageIds.delete(messageId);
		const pinnedIds = roomState.pinnedIds;
		if (pinnedIds.has(messageId)) {
			pinnedIds.delete(messageId);
			savePinnedIds(pinnedIds);
		}
		applyFilters();
		renderPinnedBoard();
		setStatus(liveStatus, "Message deleted.");
	};

	const setRoomUi = (room) => {
		const label = ROOM_LABELS[room] || ROOM_LABELS.global;
		activeRoomLabel.textContent = label;
		chatRoomHeading.textContent = label;
		roomList.querySelectorAll(".room-pill").forEach((button) => {
			button.classList.toggle("is-active", button.dataset.room === room);
		});
	};

	const switchRoom = async (room) => {
		const normalized = normalizeRoom(room);
		if (roomState.current === normalized) {
			return;
		}

		roomState.current = normalized;
		safeStorageSet(STORAGE_KEYS.room, normalized);
		setRoomUi(normalized);

		msgInput.value = safeStorageGet(getDraftStorageKey(normalized), "");
		autoGrowTextarea(msgInput);
		updateCharCounter(msgInput, charCounter);
		await loadMessages();
	};

	const notifyIncomingMessage = async (messageData) => {
		if (!isMessageInCurrentRoom(messageData, roomState.current, supportsRoomColumn)) {
			return;
		}

		if (!("Notification" in window)) {
			return;
		}

		if (Notification.permission === "default") {
			await Notification.requestPermission();
		}

		if (Notification.permission !== "granted") {
			return;
		}

		new Notification(`GpChat • ${getShortNameFromEmail(messageData.user_email)}`, {
			body: truncateText(getMessageDisplayText(messageData), 120),
		});
	};

	const playIncomingTone = () => {
		if (!soundEnabled) {
			return;
		}

		if (!audioContext) {
			audioContext = new AudioContext();
		}

		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.type = "sine";
		oscillator.frequency.value = 740;
		gainNode.gain.value = 0.03;

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);
		oscillator.start();
		oscillator.stop(audioContext.currentTime + 0.07);
	};

	const tryHandleCommand = async (message) => {
		if (!message.startsWith("/")) {
			return false;
		}

		if (message === "/clear") {
			clearMessageCollection();
			setStatus(liveStatus, "Local chat cleared.");
			applyFilters();
			renderPinnedBoard();
			return true;
		}

		if (message === "/theme") {
			currentTheme = currentTheme === "noir" ? "sunrise" : "noir";
			applyTheme(currentTheme);
			themeToggleBtn.textContent = currentTheme === "noir" ? "Sunrise" : "Noir";
			setStatus(liveStatus, `Theme set to ${currentTheme}.`);
			return true;
		}

		if (message === "/shrug") {
			msgInput.value = "\\_(o_o)_/";
			autoGrowTextarea(msgInput);
			updateCharCounter(msgInput, charCounter);
			return true;
		}

		if (message.startsWith("/me ")) {
			msgInput.value = `* ${getShortNameFromEmail(currentUser.email)} ${message.slice(4)}`;
			autoGrowTextarea(msgInput);
			updateCharCounter(msgInput, charCounter);
			return true;
		}

		if (message.startsWith("/room ")) {
			const nextRoom = normalizeRoom(message.slice(6).trim());
			await switchRoom(nextRoom);
			setStatus(liveStatus, `Switched to ${ROOM_LABELS[nextRoom]}.`);
			return true;
		}

		setStatus(liveStatus, "Unknown command. Try /clear, /theme, /shrug, /me, or /room", true);
		return true;
	};

	const sendTypingEvent = () => {
		if (!msgInput.value.trim()) {
			return;
		}

		channel.send({
			type: "broadcast",
			event: "typing",
			payload: {
				room: roomState.current,
				user_email: currentUser.email,
				at: Date.now(),
			},
		});
	};

	const sendMessage = async () => {
		const message = msgInput.value.trim();
		if (!message) {
			return;
		}

		if (await tryHandleCommand(message)) {
			msgInput.value = "";
			safeStorageRemove(getDraftStorageKey(roomState.current));
			autoGrowTextarea(msgInput);
			updateCharCounter(msgInput, charCounter);
			return;
		}

		setStatus(liveStatus, "Sending message...");
		const payload = {
			user_email: currentUser.email,
			message,
		};
		if (supportsRoomColumn) {
			payload.room = roomState.current;
		}

		const { error } = await supabase.from("messages").insert([payload]);
		if (error) {
			const text = String(error.message || "");
			if (text.toLowerCase().includes("room")) {
				supportsRoomColumn = false;
			}
			setStatus(liveStatus, `Send failed: ${error.message}`, true);
			return;
		}

		msgInput.value = "";
		safeStorageRemove(getDraftStorageKey(roomState.current));
		autoGrowTextarea(msgInput);
		updateCharCounter(msgInput, charCounter);
		setStatus(liveStatus, "Delivered.");
	};

	const channel = supabase
		.channel("gpchat-main")
		.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
			appendOrUpdateMessage(payload.new);
		})
		.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
			appendOrUpdateMessage(payload.new);
		})
		.on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
			const messageId = payload.old?.id;
			if (!messageId) {
				return;
			}
			const element = messageElementsById.get(messageId);
			if (element) {
				element.remove();
			}
			messageElementsById.delete(messageId);
			messageDataById.delete(messageId);
			renderedMessageIds.delete(messageId);
			applyFilters();
			renderPinnedBoard();
		})
		.on("broadcast", { event: "typing" }, ({ payload }) => {
			if (!payload || payload.user_email === currentUser.email || payload.room !== roomState.current) {
				return;
			}
			remoteTypingMap.set(payload.user_email, Date.now() + 3200);
			updateTypingStatus();
		})
		.subscribe((status) => {
			if (status === "SUBSCRIBED") {
				setStatus(liveStatus, `Connected to ${ROOM_LABELS[roomState.current]}. Live updates enabled.`);
			}
		});

	setRoomUi(roomState.current);
	await loadMessages();

	typingClearId = window.setInterval(() => {
		let hasActive = false;
		remoteTypingMap.forEach((expiresAt, email) => {
			if (expiresAt <= Date.now()) {
				remoteTypingMap.delete(email);
			} else {
				hasActive = true;
			}
		});
		if (!hasActive) {
			typingStatus.textContent = "";
		} else {
			updateTypingStatus();
		}
	}, 600);

	composerForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		await sendMessage();
	});

	msgInput.addEventListener("keydown", async (event) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			await sendMessage();
		}
	});

	msgInput.addEventListener("input", () => {
		autoGrowTextarea(msgInput);
		updateCharCounter(msgInput, charCounter);
		safeStorageSet(getDraftStorageKey(roomState.current), msgInput.value);

		window.clearTimeout(typingDebounceId);
		typingDebounceId = window.setTimeout(sendTypingEvent, 150);
	});

	searchInput.addEventListener("input", applyFilters);
	mineOnlyToggle.addEventListener("change", applyFilters);

	themeToggleBtn.addEventListener("click", () => {
		currentTheme = currentTheme === "noir" ? "sunrise" : "noir";
		applyTheme(currentTheme);
		themeToggleBtn.textContent = currentTheme === "noir" ? "Sunrise" : "Noir";
	});

	soundToggleBtn.addEventListener("click", () => {
		soundEnabled = !soundEnabled;
		safeStorageSet(STORAGE_KEYS.sound, soundEnabled ? "on" : "off");
		soundToggleBtn.textContent = soundEnabled ? "Sound On" : "Sound Off";
	});

	jumpBottomBtn.addEventListener("click", () => {
		chatBox.scrollTop = chatBox.scrollHeight;
	});

	chatBox.addEventListener("scroll", () => {
		jumpBottomBtn.classList.toggle("is-visible", !isNearBottom(chatBox));
	});

	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) {
			unreadCount = 0;
			refreshDocumentTitle();
		}
	});

	roomList.addEventListener("click", async (event) => {
		const roomButton = event.target.closest(".room-pill");
		if (!roomButton) {
			return;
		}
		await switchRoom(roomButton.dataset.room);
	});

	clearLocalViewBtn.addEventListener("click", () => {
		clearMessageCollection();
		updateStats();
		renderPinnedBoard();
		setStatus(liveStatus, "Local view cleared. New and reloaded messages will appear.");
	});

	logoutBtn.addEventListener("click", async () => {
		await supabase.removeChannel(channel);
		window.clearInterval(typingClearId);
		await supabase.auth.signOut();
		window.location.href = "login.html";
	});

	window.addEventListener("beforeunload", async () => {
		await supabase.removeChannel(channel);
		window.clearInterval(typingClearId);
	});
}

function normalizeRoom(roomValue) {
	const normalized = String(roomValue || "global").toLowerCase();
	if (!ROOM_LABELS[normalized]) {
		return "global";
	}
	return normalized;
}

function getDraftStorageKey(room) {
	return `${STORAGE_KEYS.draft}_${normalizeRoom(room)}`;
}

function getPinnedByRoom() {
	const raw = safeStorageGet(STORAGE_KEYS.pinnedByRoom, "{}");
	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") {
			return {};
		}
		return parsed;
	} catch {
		return {};
	}
}

function savePinnedByRoom(value) {
	safeStorageSet(STORAGE_KEYS.pinnedByRoom, JSON.stringify(value));
}

function normalizeMessage(rawData, supportsRoomColumn) {
	return {
		id: rawData?.id,
		user_email: rawData?.user_email || "unknown@gpchat",
		message: rawData?.message || "",
		created_at: rawData?.created_at || new Date().toISOString(),
		updated_at: rawData?.updated_at || null,
		is_deleted: Boolean(rawData?.is_deleted),
		room: supportsRoomColumn ? normalizeRoom(rawData?.room || "global") : "global",
	};
}

function isMessageInCurrentRoom(message, currentRoom, supportsRoomColumn) {
	if (!supportsRoomColumn) {
		return true;
	}
	return normalizeRoom(message.room) === normalizeRoom(currentRoom);
}

function getMessageDisplayText(message) {
	if (!message) {
		return "";
	}
	if (message.is_deleted) {
		return "[deleted]";
	}
	return message.message || "";
}

function copyText(value) {
	if (!navigator.clipboard || !navigator.clipboard.writeText) {
		return Promise.resolve();
	}

	return navigator.clipboard.writeText(value);
}

function setMessageBody(element, text) {
	const content = text || "";
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	let lastIndex = 0;
	let match;

	while ((match = urlRegex.exec(content)) !== null) {
		const [url] = match;
		const start = match.index;

		if (start > lastIndex) {
			element.appendChild(document.createTextNode(content.slice(lastIndex, start)));
		}

		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.target = "_blank";
		anchor.rel = "noopener noreferrer";
		anchor.textContent = url;
		element.appendChild(anchor);

		lastIndex = start + url.length;
	}

	if (lastIndex < content.length) {
		element.appendChild(document.createTextNode(content.slice(lastIndex)));
	}
}

function truncateText(text, maxLength) {
	if (!text || text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength - 1)}...`;
}

function isNearBottom(container) {
	return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
}

function updateCharCounter(input, counterElement) {
	if (!counterElement) {
		return;
	}

	counterElement.textContent = `${input.value.length} / ${input.maxLength || 1000}`;
}

function autoGrowTextarea(textarea) {
	textarea.style.height = "auto";
	textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

function formatTime(value) {
	if (!value) {
		return "just now";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "just now";
	}

	return new Intl.DateTimeFormat("en", {
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}
