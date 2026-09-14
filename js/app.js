const App = {
    activeEngine: null,

    init() {
        this.applyTheme();
        try {
            db.init().then(() => {
                window.addEventListener('hashchange', () => this.handleRoute());
                this.handleRoute();
                this.initPWA();
            }).catch(err => {
                console.error("Error al iniciar DB", err);
            });
        } catch (err) {
            console.error("Error al iniciar DB", err);
        }
    },

    applyTheme(theme = localStorage.getItem('locallearn-theme') || 'dark') {
        document.body.dataset.theme = theme;
        localStorage.setItem('locallearn-theme', theme);
    },

    toggleTheme() {
        const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
        return next;
    },

    bindAnimations() {
        const items = document.querySelectorAll('[data-animate]');
        items.forEach((node, index) => {
            node.style.animationDelay = `${index * 60}ms`;
            node.classList.remove('animate-fade-up');
            void node.offsetWidth;
            node.classList.add('animate-fade-up');
        });
    },

    async handleRoute() {
        if (this.activeEngine && this.activeEngine.cleanup) {
            this.activeEngine.cleanup();
            this.activeEngine = null;
        }

        const hash = window.location.hash || '#/home';
        const parts = hash.replace('#/', '').split('/');
        const route = parts[0];
        const id = parts[1];
        const subRoute = parts[2];

        this.updateNav(route);

        const root = document.getElementById('app-root');
        root.innerHTML = '<div class="container text-center mt-2"><p class="text-muted">Cargando...</p></div>';

        let viewResult = { html: '', attach: () => {} };

        if (route === 'home') viewResult = await Views.home();
        else if (route === 'library') viewResult = await Views.library();
        else if (route === 'study') viewResult = await Views.studyHome(id);
        else if (route === 'import') viewResult = await Views.importView();
        else if (route === 'settings') viewResult = await Views.settings();
        else if (route === 'editor') viewResult = await Editor.render(id);
        else if (route === 'play') {
            const unit = await db.getUnit(id);
            if (!unit) {
                viewResult = { html: `<div class="container">Unidad no encontrada</div>`, attach: () => {} };
            } else if (subRoute === 'flashcards') this.activeEngine = Engine.renderFlashcards(unit);
            else if (subRoute === 'learn') this.activeEngine = Engine.renderLearn(unit);
            else if (subRoute === 'test') this.activeEngine = Engine.renderTest(unit);
            else if (subRoute === 'match') this.activeEngine = Engine.renderMatch(unit);

            if (this.activeEngine) {
                viewResult = { html: this.activeEngine.render(), attach: this.activeEngine.attach };
            }
        }

        root.innerHTML = viewResult.html;
        if (viewResult.attach) viewResult.attach();
        this.bindAnimations();
        lucide.createIcons();
    },

    renderView() {
        if (this.activeEngine) {
            const root = document.getElementById('app-root');
            root.innerHTML = this.activeEngine.render();
            this.activeEngine.attach();
            this.bindAnimations();
            lucide.createIcons();
        }
    },

    updateNav(route) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const active = document.querySelector(`.nav-item[data-route="${route}"]`);
        if (active) active.classList.add('active');
    },

    showToast(message, type = 'info') {
        const root = document.getElementById('toast-root');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${DOMPurify.sanitize(message)}</span>
            <button class="toast-close" aria-label="Cerrar notificación"><i data-lucide="x"></i></button>
        `;
        root.appendChild(toast);
        lucide.createIcons({ nameAttr: 'data-lucide' });

        const close = () => {
            toast.classList.add('toast-exit');
            setTimeout(() => {
                if (toast.parentNode) root.removeChild(toast);
            }, 260);
        };

        toast.querySelector('.toast-close').addEventListener('click', close);
        setTimeout(close, 3200);
    },

    showModal({ title, body, confirmText = "Aceptar", onConfirm }) {
        const root = document.getElementById('modal-root');
        root.innerHTML = `
            <div class="modal-content">
                <h2>${DOMPurify.sanitize(title)}</h2>
                <p class="text-muted mt-1">${DOMPurify.sanitize(body)}</p>
                <div class="modal-actions">
                    <button id="modal-cancel-btn" class="btn btn-secondary">Cancelar</button>
                    <button id="modal-confirm-btn" class="btn btn-danger">${DOMPurify.sanitize(confirmText)}</button>
                </div>
            </div>
        `;
        root.classList.remove('hidden');

        document.getElementById('modal-cancel-btn').onclick = () => root.classList.add('hidden');
        document.getElementById('modal-confirm-btn').onclick = async () => {
            root.classList.add('hidden');
            if (onConfirm) await onConfirm();
        };
    },

    initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => console.error("Error SW", err));
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());