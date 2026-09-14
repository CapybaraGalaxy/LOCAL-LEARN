const Views = {
    async home() {
        const units = await db.getAllUnits();
        
        if (units.length === 0) {
            return `
                <div class="container text-center" style="margin-top: 10vh;">
                    <h1>Local Learn</h1>
                    <p class="text-muted" style="margin-bottom: 2rem;">Aprende sin cuentas. Guarda tus unidades como archivos. Estudia offline.</p>
                    <a href="#/editor/new" class="btn btn-primary">Crear mi primera unidad</a>
                    <a href="#/import" class="btn btn-secondary mt-2">Importar una unidad</a>
                </div>
            `;
        }

        let html = `<div class="container"><h1>Continuar estudiando</h1><div class="grid">`;
        units.slice(0, 4).forEach(u => {
            const safeTitle = DOMPurify.sanitize(u.title);
            html += `
                <a class="unit-card" href="#/study/${u.id}">
                    <h3>${safeTitle}</h3>
                    <p class="text-muted">${u.cards.length} términos</p>
                    <div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div>
                </a>
            `;
        });
        html += `</div></div>`;
        return { html, attach: () => {} };
    },

    async library() {
        const units = await db.getAllUnits();
        let html = `<div class="container"><div class="header-flex">
            <h1>Tu Biblioteca</h1>
            <a href="#/editor/new" class="btn btn-primary btn-icon"><i data-lucide="plus"></i></a>
        </div><div class="grid">`;
        
        units.forEach(u => {
            const safeTitle = DOMPurify.sanitize(u.title);
            html += `
                <div class="unit-card">
                    <h3>${safeTitle}</h3>
                    <p class="text-muted">${u.cards.length} tarjetas</p>
                    <div style="display:flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <a href="#/study/${u.id}" class="btn btn-primary" style="flex:1; padding: 0.5rem;">Estudiar</a>
                        <a href="#/editor/${u.id}" class="btn btn-secondary btn-icon"><i data-lucide="edit"></i></a>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
        return { html, attach: () => {} };
    },

    async studyHome(id) {
        const unit = await db.getUnit(id);
        if(!unit) return { html: `<div class="container">Error: Unidad no encontrada</div>`, attach: () => {} };

        const html = `
            <div class="container text-center">
                <h1 style="font-size: 2rem; margin-top: 2rem;">${DOMPurify.sanitize(unit.title)}</h1>
                <p class="text-muted">${unit.cards.length} tarjetas</p>
                
                <div class="grid" style="margin-top: 3rem;">
                    <a href="#/play/${id}/flashcards" class="unit-card text-center">
                        <i data-lucide="layers" style="margin: 0 auto; color: var(--primary);"></i>
                        <h3>Flashcards</h3>
                    </a>
                    <a href="#/play/${id}/learn" class="unit-card text-center">
                        <i data-lucide="brain" style="margin: 0 auto; color: var(--primary);"></i>
                        <h3>Aprender</h3>
                    </a>
                </div>
                
                <div style="margin-top: 3rem; display: flex; justify-content: center; gap: 1rem;">
                    <a href="#/editor/${id}" class="btn btn-secondary"><i data-lucide="edit"></i> Editar</a>
                    <button id="btn-export" class="btn btn-secondary"><i data-lucide="share"></i> Exportar</button>
                </div>
            </div>
        `;

        return { 
            html, 
            attach: () => {
                document.getElementById('btn-export').addEventListener('click', async () => {
                    App.showToast("Generando archivo...");
                    try {
                        await Format.createLocallearnFile(id);
                        App.showToast("Exportado correctamente");
                    } catch (e) {
                        App.showToast("Error al exportar");
                    }
                });
            } 
        };
    },

    async importView() {
        const html = `
            <div class="container">
                <h1>Importar Unidad</h1>
                
                <div class="editor-card mt-2">
                    <h2>Archivo .locallearn</h2>
                    <p class="text-muted mb-2">Restaura una unidad creada previamente.</p>
                    <input type="file" id="file-import" accept=".locallearn,.zip" style="display:none;">
                    <button class="btn btn-secondary" onclick="document.getElementById('file-import').click()">
                        Seleccionar Archivo
                    </button>
                </div>

                <div class="editor-card mt-2">
                    <h2>Pegar desde Quizlet</h2>
                    <p class="text-muted mb-2">Pega texto con formato: Término [Tabulador] Definición.</p>
                    <textarea id="import-text" class="form-control" rows="5" placeholder="Término\tDefinición..."></textarea>
                    <button id="btn-import-text" class="btn btn-primary" style="margin-top: 1rem;">Importar Texto</button>
                </div>
            </div>
        `;

        return {
            html,
            attach: () => {
                document.getElementById('file-import').addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if(!file) return;
                    App.showToast("Importando...");
                    try {
                        const id = await Format.importLocallearn(file);
                        window.location.hash = `/study/${id}`;
                    } catch (error) {
                        App.showToast(error.message);
                    }
                });

                document.getElementById('btn-import-text').addEventListener('click', async () => {
                    const text = document.getElementById('import-text').value;
                    if(!text) return;
                    try {
                        const unit = Format.importQuizletText(text);
                        await db.saveUnit(unit);
                        window.location.hash = `/study/${unit.id}`;
                    } catch (error) {
                        App.showToast(error.message);
                    }
                });
            }
        };
    }
};