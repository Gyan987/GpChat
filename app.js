import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://kvjlbzjhepezyktycbcm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2amxiempoZXBlenlrdHljYmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NDU0NzMsImV4cCI6MjA4MjUyMTQ3M30.hdOTo-HTZwRtm3nbogjovJmguU_z20P2VCpU_J3Be-Q";

export const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEYS = {
	theme: "gpchat_theme",
	sound: "gpchat_sound",
	draft: "gpchat_draft",
	pinned: "gpchat_pinned",
};

const pathname = window.location.pathname.toLowerCase();
const isLoginPage = pathname.endsWith("login.html") || pathname.endsWith("/");
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
		// Ignore storage failures in restricted browser modes.
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

	if (!emailInput || !passwordInput || !loginBtn || !signupBtn) {
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
		const email = emailInput.value.trim();
		const password = passwordInput.value;
		return { email, password };
	};

	loginBtn.addEventListener("click", async () => {
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
	});

	signupBtn.addEventListener("click", async () => {
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
	});
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
	const profileEmail = document.getElementById("profileEmail");
	const avatarBadge = document.getElementById("avatarBadge");
	const clearLocalViewBtn = document.getElementById("clearLocalViewBtn");
	const logoutBtn = document.getElementById("logoutBtn");

	if (!chatBox || !msgInput || !composerForm) {
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
	msgInput.value = safeStorageGet(STORAGE_KEYS.draft, "");
	autoGrowTextarea(msgInput);
	updateCharCounter(msgInput, charCounter);

	let soundEnabled = safeStorageGet(STORAGE_KEYS.sound, "on") !== "off";
	let unreadCount = 0;
	let audioContext;
	let currentTheme = safeStorageGet(STORAGE_KEYS.theme, "sunrise") === "noir" ? "noir" : "sunrise";
	const pinnedMessageIds = new Set(getPinnedMessageIds());
	const renderedMessageIds = new Set();
	const messageDataById = new Map();
	const messageElementsById = new Map();

	themeToggleBtn.textContent = currentTheme === "noir" ? "Sunrise" : "Noir";
	soundToggleBtn.textContent = soundEnabled ? "Sound On" : "Sound Off";

	const chatTitleBase = "GpChat | Chat";

	const refreshDocumentTitle = () => {
		document.title = unreadCount > 0 ? `(${unreadCount}) ${chatTitleBase}` : chatTitleBase;
	};

	const updateStats = () => {
		const total = messageElementsById.size;
		const visible = Array.from(messageElementsById.values()).filter((item) => !item.classList.contains("is-hidden")).length;
		messageStats.textContent = `${visible} visible of ${total} messages`;
		emptyFeedHint.classList.toggle("show", total > 0 && visible === 0);
	};

	const applyFilters = () => {
		const query = (searchInput.value || "").trim().toLowerCase();
		const mineOnly = mineOnlyToggle.checked;

		messageElementsById.forEach((el, id) => {
			const message = messageDataById.get(id);
			if (!message) {
				return;
			}

			const mineMatch = !mineOnly || message.user_email === currentUser.email;
			const queryMatch =
				!query ||
				message.message.toLowerCase().includes(query) ||
				message.user_email.toLowerCase().includes(query);

			el.classList.toggle("is-hidden", !(mineMatch && queryMatch));
		});

		updateStats();
	};

	const savePinnedIds = () => {
		safeStorageSet(STORAGE_KEYS.pinned, JSON.stringify(Array.from(pinnedMessageIds)));
	};

	const renderPinnedBoard = () => {
		pinBoard.innerHTML = "";
		if (!pinnedMessageIds.size) {
			const placeholder = document.createElement("p");
			placeholder.className = "panel-empty";
			placeholder.textContent = "Pin any message to keep it here.";
			pinBoard.appendChild(placeholder);
			return;
		}

		Array.from(pinnedMessageIds)
			.reverse()
			.forEach((id) => {
				const pinnedMessage = messageDataById.get(id);
				if (!pinnedMessage) {
					return;
				}

				const card = document.createElement("article");
				card.className = "pin-card";

				const title = document.createElement("p");
				title.className = "pin-title";
				title.textContent = getShortNameFromEmail(pinnedMessage.user_email);

				const body = document.createElement("p");
				body.className = "pin-body";
				body.textContent = truncateText(pinnedMessage.message, 72);

				card.appendChild(title);
				card.appendChild(body);
				card.addEventListener("click", () => {
					const target = messageElementsById.get(id);
					if (!target) {
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
		if (pinnedMessageIds.has(id)) {
			pinnedMessageIds.delete(id);
		} else {
			pinnedMessageIds.add(id);
		}

		savePinnedIds();
		renderPinnedBoard();

		const messageEl = messageElementsById.get(id);
		if (messageEl) {
			messageEl.classList.toggle("is-pinned", pinnedMessageIds.has(id));
			const pinButton = messageEl.querySelector("[data-action='pin']");
			if (pinButton) {
				pinButton.textContent = pinnedMessageIds.has(id) ? "Unpin" : "Pin";
			}
		}
	};

	const appendMessage = (data) => {
		const messageId = data.id || `${data.user_email}-${data.message}-${data.created_at}`;
		if (renderedMessageIds.has(messageId)) {
			return;
		}
		renderedMessageIds.add(messageId);
		messageDataById.set(messageId, data);

		const isMine = data.user_email === currentUser.email;
		const item = document.createElement("article");
		item.className = `msg-item ${isMine ? "mine" : ""}`;
		item.dataset.messageId = messageId;

		const sender = document.createElement("p");
		sender.className = "msg-sender";
		sender.textContent = isMine ? "You" : getShortNameFromEmail(data.user_email);

		const body = document.createElement("p");
		body.className = "msg-body";
		setMessageBody(body, data.message);

		const actionRow = document.createElement("div");
		actionRow.className = "msg-actions";

		const pinButton = document.createElement("button");
		pinButton.type = "button";
		pinButton.className = "msg-action";
		pinButton.dataset.action = "pin";
		pinButton.textContent = pinnedMessageIds.has(messageId) ? "Unpin" : "Pin";

		const copyButton = document.createElement("button");
		copyButton.type = "button";
		copyButton.className = "msg-action";
		copyButton.dataset.action = "copy";
		copyButton.textContent = "Copy";

		actionRow.appendChild(pinButton);
		actionRow.appendChild(copyButton);

		const ts = document.createElement("time");
		ts.className = "msg-time";
		ts.textContent = formatTime(data.created_at);

		item.appendChild(sender);
		item.appendChild(body);
		item.appendChild(actionRow);
		item.appendChild(ts);
		chatBox.appendChild(item);

		if (pinnedMessageIds.has(messageId)) {
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
				await copyText(data.message);
				setStatus(liveStatus, "Message copied to clipboard.");
			}
		});

		messageElementsById.set(messageId, item);
		applyFilters();
		renderPinnedBoard();

		if (isNearBottom(chatBox)) {
			chatBox.scrollTop = chatBox.scrollHeight;
		}

		if (!isMine) {
			if (document.hidden) {
				unreadCount += 1;
				refreshDocumentTitle();
				notifyIncomingMessage(data);
			}
			playIncomingTone();
		}
	};

	try {
		const { data, error } = await supabase
			.from("messages")
			.select("id, user_email, message, created_at")
			.order("created_at", { ascending: true })
			.limit(250);

		if (error) {
			throw error;
		}

		data.forEach(appendMessage);
		setStatus(liveStatus, "Connected. Live updates enabled.");
	} catch {
		const { data, error } = await supabase
			.from("messages")
			.select("id, user_email, message")
			.limit(250);

		if (!error && data) {
			data.forEach(appendMessage);
			setStatus(liveStatus, "Connected. Limited timestamp support.");
		} else {
			setStatus(liveStatus, "Unable to load chat history.", true);
		}
	}

	applyFilters();
	renderPinnedBoard();

	const channel = supabase
		.channel("public:messages")
		.on(
			"postgres_changes",
			{ event: "INSERT", schema: "public", table: "messages" },
			(payload) => {
				appendMessage(payload.new);
			}
		)
		.subscribe((status) => {
			if (status === "SUBSCRIBED") {
				setStatus(liveStatus, "Connected. Live updates enabled.");
			}
		});

	const sendMessage = async () => {
		const message = msgInput.value.trim();
		if (!message) {
			return;
		}

		if (tryHandleCommand(message)) {
			msgInput.value = "";
			safeStorageSet(STORAGE_KEYS.draft, "");
			autoGrowTextarea(msgInput);
			updateCharCounter(msgInput, charCounter);
			return;
		}

		setStatus(liveStatus, "Sending message...");
		const { error } = await supabase.from("messages").insert([
			{
				user_email: currentUser.email,
				message,
			},
		]);

		if (error) {
			setStatus(liveStatus, `Send failed: ${error.message}`, true);
			return;
		}

		msgInput.value = "";
		safeStorageSet(STORAGE_KEYS.draft, "");
		autoGrowTextarea(msgInput);
		updateCharCounter(msgInput, charCounter);
		setStatus(liveStatus, "Delivered.");
	};

	const tryHandleCommand = (message) => {
		if (!message.startsWith("/")) {
			return false;
		}

		if (message === "/clear") {
			chatBox.querySelectorAll(".msg-item").forEach((item) => item.remove());
			renderedMessageIds.clear();
			messageDataById.clear();
			messageElementsById.clear();
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

		setStatus(liveStatus, "Unknown command. Try /clear, /theme, /shrug, or /me", true);
		return true;
	};

	const notifyIncomingMessage = async (messageData) => {
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
			body: truncateText(messageData.message, 120),
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
		safeStorageSet(STORAGE_KEYS.draft, msgInput.value);
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

	clearLocalViewBtn.addEventListener("click", () => {
		chatBox.querySelectorAll(".msg-item").forEach((item) => item.remove());
		renderedMessageIds.clear();
		messageDataById.clear();
		messageElementsById.clear();
		updateStats();
		renderPinnedBoard();
		setStatus(liveStatus, "Local view cleared. New and reloaded messages will appear.");
	});

	logoutBtn.addEventListener("click", async () => {
		await supabase.removeChannel(channel);
		await supabase.auth.signOut();
		window.location.href = "login.html";
	});

	window.addEventListener("beforeunload", async () => {
		await supabase.removeChannel(channel);
	});
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

function getPinnedMessageIds() {
	const raw = safeStorageGet(STORAGE_KEYS.pinned, "[]");
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function truncateText(text, maxLength) {
	if (text.length <= maxLength) {
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
