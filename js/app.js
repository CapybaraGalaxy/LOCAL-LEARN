const App = {
    currentRoute: null,
    currentParams: {},
    activeEngineModule: null,

    async init() {
        try {
            await db.init();
            window.addEventListener('hashchange', () => this.handleRoute());
            this.handleRoute(); // Carga inicial
            this.initPWA();
        } catch (error) {
            document.getElementById('app-root').innerHTML = `<div class="container"><h2>Error de base de datos</h2><p>${error}</p></div>`;
        }
    },

    async handleRoute() {
        const hash = window.location.hash || '#/home';
        const parts = hash.replace('#/', '').split('/');
        const route = parts[0];
        const id = parts[1];
        const subRoute = parts[2];

        this.currentRoute = route;
        this.updateNav(route);
        this.activeEngineModule = null; // Reset engine

        const root = document.getElementById('app-root');
        root.innerHTML = '<div class="container text-center mt-2"><i data-lucide="loader" class="spin"></i> Cargando...</div>';
        lucide.createIcons();

        try {
            let viewResult;
            if (route === 'home') viewResult = await Views.home();
            else if (route === 'library') viewResult = await Views.library();
            else if (route === 'study') viewResult = await Views.studyHome(id);
            else if (route === 'import') viewResult = await Views.importView();
            else if (route === 'play') {
                const engineData = await Engine.initStudySession(id);
                if (subRoute === 'flashcards') this.activeEngineModule = Engine.renderFlashcards(engineData.unit);
                else if (subRoute === 'learn') this.activeEngineModule = Engine.renderLearn(engineData.unit);
                viewResult = { html: this.activeEngineModule.render(), attach: this.activeEngineModule.attach };
            }
            else {
                // Fallback o vistas por implementar en este snippet (Editor V1 básico, Settings, etc.)
                viewResult = { html: `<div class="container"><h2>Módulo en construcción (${route})</h2><a href="#/home">Volver</a></div>`, attach: () => {} };
            }

            root.innerHTML = viewResult.html;
            if (viewResult.attach) viewResult.attach();
            lucide.createIcons();

        } catch (error) {
            console.error(error);
            root.innerHTML = `<div class="container"><h2>Error</h2><p>${error.message}</p></div>`;
        }
    },

    renderView() {
        // Renderizado rápido para cambios de estado en módulos Engine
        if (this.activeEngineModule) {
            const root = document.getElementById('app-root');
            root.innerHTML = this.activeEngineModule.render();
            this.activeEngineModule.attach();
            lucide.createIcons();
        }
    },

    updateNav(route) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.nav-item[data-route="${route}"]`);
        if (activeItem) activeItem.classList.add('active');
    },

    showToast(message) {
        const root = document.getElementById('toast-root');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        root.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => root.removeChild(toast), 300);
        }, 3000);
    },

    initPWA() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(reg => console.log('SW Registrado', reg.scope))
                    .catch(err => console.log('SW Error', err));
            });
        }
    }
};

// Arranque
document.addEventListener('DOMContentLoaded', () => App.init());