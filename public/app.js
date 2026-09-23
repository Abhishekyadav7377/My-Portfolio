// ================= TYPING EFFECT =================
const typedTextSpan = document.querySelector(".typing-text");
const cursorSpan = document.querySelector(".cursor");

const textArray = [
    "AI/ML Developer",
    "Full Stack Developer",
    "Python Developer",
    "Problem Solver"
];
const typingDelay = 100;
const erasingDelay = 80;
const newTextDelay = 2000;
let textArrayIndex = 0;
let charIndex = 0;

function type() {
    if (typedTextSpan && charIndex < textArray[textArrayIndex].length) {
        if (cursorSpan) cursorSpan.classList.add("typing");
        typedTextSpan.textContent += textArray[textArrayIndex].charAt(charIndex);
        charIndex++;
        setTimeout(type, typingDelay);
    } else {
        if (cursorSpan) cursorSpan.classList.remove("typing");
        setTimeout(erase, newTextDelay);
    }
}

function erase() {
    if (typedTextSpan && charIndex > 0) {
        if (cursorSpan) cursorSpan.classList.add("typing");
        typedTextSpan.textContent = textArray[textArrayIndex].substring(0, charIndex - 1);
        charIndex--;
        setTimeout(erase, erasingDelay);
    } else {
        if (cursorSpan) cursorSpan.classList.remove("typing");
        textArrayIndex++;
        if (textArrayIndex >= textArray.length) textArrayIndex = 0;
        setTimeout(type, typingDelay + 400);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (typedTextSpan) setTimeout(type, newTextDelay);
});


// ================= SMOOTH SCROLL & AUTO NAVBAR COLLAPSE =================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
        const href = this.getAttribute("href");
        if (!href || href === "#") return;

        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const navbarHeight = document.getElementById("navbar")?.offsetHeight || 70;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - (navbarHeight - 10);

            window.scrollTo({
                top: targetPosition,
                behavior: "smooth"
            });

            // Close mobile navbar after clicking link
            const navbarCollapse = document.getElementById("navbarNav");
            if (navbarCollapse && navbarCollapse.classList.contains("show")) {
                const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse) || new bootstrap.Collapse(navbarCollapse);
                if (bsCollapse) bsCollapse.hide();
            }
        }
    });
});


// ================= NAVBAR ACTIVE + SHADOW ON SCROLL =================
const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".navbar-nav .nav-link");

window.addEventListener("scroll", () => {
    let current = "";
    const scrollPos = window.scrollY + 120;

    sections.forEach((section) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
            current = section.getAttribute("id");
        }
    });

    navLinks.forEach((link) => {
        link.classList.remove("active");
        if (current && link.getAttribute("href") === "#" + current) {
            link.classList.add("active");
        }
    });

    const navbar = document.getElementById("navbar");
    if (navbar) {
        if (window.scrollY > 40) {
            navbar.classList.add("navbar-scrolled");
        } else {
            navbar.classList.remove("navbar-scrolled");
        }
    }
});


// ================= CONTACT FORM =================
const form = document.getElementById("contact-form");

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const button = form.querySelector("button[type='submit']");
        const originalText = button.innerHTML;

        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending...';
        button.disabled = true;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch("/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showMessage("✅ Message sent successfully! I will get back to you soon.", "success");
                form.reset();
            } else {
                showMessage("❌ " + (result.error || "Failed to send message. Please try again."), "error");
            }

        } catch (err) {
            showMessage("❌ Server error. Please connect directly via email or phone.", "error");
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    });
}


// ================= MESSAGE SHOW FUNCTION =================
function showMessage(msg, type) {
    let msgBox = document.getElementById("form-message");

    if (!msgBox) {
        msgBox = document.createElement("div");
        msgBox.id = "form-message";
        msgBox.className = "alert mt-3 py-2 text-center";
        document.getElementById("contact-form").appendChild(msgBox);
    }

    msgBox.innerText = msg;
    msgBox.className = `alert mt-3 py-2 text-center ${type === "success" ? "alert-success bg-opacity-25 border-success text-white" : "alert-danger bg-opacity-25 border-danger text-white"}`;
    msgBox.style.display = "block";

    setTimeout(() => {
        if (msgBox) {
            msgBox.style.display = "none";
        }
    }, 4500);
}