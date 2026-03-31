import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://kvjlbzjhepezyktycbcm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2amxiempoZXBlenlrdHljYmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NDU0NzMsImV4cCI6MjA4MjUyMTQ3M30.hdOTo-HTZwRtm3nbogjovJmguU_z20P2VCpU_J3Be-Q";

export const supabase = createClient(supabaseUrl, supabaseKey);

const pathname = window.location.pathname.toLowerCase();
const isLoginPage = pathname.endsWith("login.html") || pathname.endsWith("/");
const isChatPage = pathname.endsWith("chat.html");

if (isLoginPage) {
	initializeLoginPage();
}

if (isChatPage) {
	initializeChatPage();
}

function setStatus(element, text, isError = false) {
	if (!element) {
		return;
	}

	element.textContent = text;
	element.classList.toggle("status-error", isError);
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

	const renderedMessageIds = new Set();

	const appendMessage = (data) => {
		const messageId = data.id || `${data.user_email}-${data.message}-${data.created_at}`;
		if (renderedMessageIds.has(messageId)) {
			return;
		}
		renderedMessageIds.add(messageId);

		const isMine = data.user_email === currentUser.email;
		const item = document.createElement("article");
		item.className = `msg-item ${isMine ? "mine" : ""}`;

		const sender = document.createElement("p");
		sender.className = "msg-sender";
		sender.textContent = isMine ? "You" : getShortNameFromEmail(data.user_email);

		const body = document.createElement("p");
		body.className = "msg-body";
		body.textContent = data.message;

		const ts = document.createElement("time");
		ts.className = "msg-time";
		ts.textContent = formatTime(data.created_at);

		item.appendChild(sender);
		item.appendChild(body);
		item.appendChild(ts);
		chatBox.appendChild(item);
		chatBox.scrollTop = chatBox.scrollHeight;
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
		autoGrowTextarea(msgInput);
		setStatus(liveStatus, "Delivered.");
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
	});

	clearLocalViewBtn.addEventListener("click", () => {
		chatBox.innerHTML = "";
		renderedMessageIds.clear();
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
