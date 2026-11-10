
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginScreen = document.getElementById("login-screen");
const portalApp = document.getElementById("portal-app");

let authorizedAdmin = false;

function showLogin() {
  authorizedAdmin = false;
  portalApp.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

async function checkAdmin() {
  const { data: { user }, error } =
    await supabaseClient.auth.getUser();

  if (error || !user) return false;

  const { data, error: adminError } = await supabaseClient
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  return !adminError && !!data;
}

async function showDashboard() {
  authorizedAdmin = true;

  try {
    await loadData();
    loginScreen.classList.add("hidden");
    portalApp.classList.remove("hidden");
  } catch (error) {
    authorizedAdmin = false;
    showLogin();
    loginError.textContent = error.message;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = loginForm.querySelector(
    'button[type="submit"]'
  );

  button.disabled = true;
  loginError.textContent = "";

  try {
    const email = document.getElementById("email")
      .value.trim();

    const password = document.getElementById("password").value;

    const { error } = await supabaseClient.auth
      .signInWithPassword({ email, password });

    if (error) throw error;

    if (!(await checkAdmin())) {
      await supabaseClient.auth.signOut();
      throw new Error("Access denied. Admins only.");
    }

    await showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

async function logout() {
  showLogin();
  await supabaseClient.auth.signOut();
  document.getElementById("password").value = "";
}

async function initializeAuth() {
  showLogin();

  if (await checkAdmin()) {
    await showDashboard();
  }
}

supabaseClient.auth.onAuthStateChange(
  (event) => {
    if (event === "SIGNED_OUT") showLogin();
  }
);

initializeAuth();

const togglePassword =
  document.getElementById("togglePassword");

const passwordInput =
  document.getElementById("password");

togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";

  togglePassword.textContent =
    isHidden ? "Hide" : "Show";

  togglePassword.setAttribute(
    "aria-label",
    isHidden ? "Hide password" : "Show password"
  );

  togglePassword.setAttribute(
    "aria-pressed",
    String(isHidden)
  );
});
