const BACKEND_URL = "http://localhost:8000";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("errorMessage");

  errorEl.textContent = ""; // clear old errors

  try {
    // Option 1: If you want backend validation
    const res = await fetch(`${BACKEND_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok && data.status === "ok") {
      // Backend approved
      if (username === "admin@ACAST") {
        localStorage.setItem("role", "superuser");
        localStorage.setItem("loggedIn", "true");
        window.location.href = "candidate.html";
      } else if (username === "view@ACAST") {
        localStorage.setItem("role", "viewer");
        localStorage.setItem("loggedIn", "true");
        window.location.href = "viewer.html";
      }
    } else {
      // Fallback: Hardcoded check (if backend is not enforcing roles)
      if (username === "admin@ACAST" && password === "Air491*") {
        localStorage.setItem("role", "superuser");
        localStorage.setItem("loggedIn", "true");
        window.location.href = "candidate.html";
      } else if (username === "view@ACAST" && password === "view825*") {
        localStorage.setItem("role", "viewer");
        localStorage.setItem("loggedIn", "true");
        window.location.href = "viewer.html";
      } else {
        errorEl.textContent = data.message || "Invalid Username or Password";
      }
    }
  } catch (err) {
    // If backend unreachable, fallback to hardcoded
    if (username === "admin@ACAST" && password === "Air491*") {
      localStorage.setItem("role", "superuser");
      localStorage.setItem("loggedIn", "true");
      window.location.href = "candidate.html";
    } else if (username === "view@ACAST" && password === "view825*") {
      localStorage.setItem("role", "viewer");
      localStorage.setItem("loggedIn", "true");
      window.location.href = "viewer.html";
    } else {
      errorEl.textContent = "Error connecting to server or wrong credentials.";
    }
  }
});
