const Views = {
    renderUnitCard(unit, compact = false) {
        const summary = unit.cards && unit.cards.length ? `${unit.cards.length} tarjetas` : 'Sin tarjetas';
        const action = compact ? 'Estudiar' : 'Abrir';
        return `
            <a href="#/study/${unit.id}" class="unit-card" data-animate>
                <div class="flex-between">
                    <span class="text-muted">${DOMPurify.sanitize(unit.author || 'Tu unidad')}</span>
                    <span class="chip">${DOMPurify.sanitize(unit.cards?.length ? 'Listo' : 'Nuevo')}</span>
                </div>
                <h3>${DOMPurify.sanitize(unit.title || 'Sin título')}</h3>
                <p class="text-muted">${DOMPurify.sanitize(unit.description || summary)}</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(100, (unit.cards?.length || 0) * 12)}%"></div>
                </div>
                <div class="flex-between mt-1">
                    <span class="text-muted">${summary}</span>
                    <span class="btn btn-primary" style="padding: 0.55rem 0.85rem; font-size: 0.8rem;">${action}</span>
                </div>
            </a>
        `;
    },

    async home() {
        const units = await db.getAllUnits();
        const totalCards = units.reduce((sum, unit) => sum + (unit.cards?.length || 0), 0);

        if (units.length === 0) {
            return {
                html: `
                    <div class="container text-center page-shell" style="margin-top: 10vh;">
                        <div class="hero-panel" data-animate>
                            <h1>Local Learn</h1>
                            <p class="text-muted mt-1 mb-2">Plataforma de estudio local-first. Tus archivos son tuyos.</p>
                            <div class="flex-between" style="justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
                                <a href="#/editor/new" class="btn btn-primary">Crear unidad</a>
                                <a href="#/import" class="btn btn-secondary">Importar archivo</a>
                            </div>
                        </div>
                    </div>
                `,
                attach: () => {}
            };
        }

        const html = `
            <div class="container page-shell">
                <section class="hero-panel" data-animate>
                    <p class="text-muted">Tu hub de estudio</p>
                    <h1>Continuar estudiando</h1>
                    <p class="text-muted">${units.length} unidades listas y ${totalCards} tarjetas disponibles para repasar.</p>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="text-muted">Unidades</span>
                            <strong>${units.length}</strong>
                        </div>
                        <div class="stat-card">
                            <span class="text-muted">Tarjetas</span>
                            <strong>${totalCards}</strong>
                        </div>
                        <div class="stat-card">
                            <span class="text-muted">Rendimiento</span>
                            <strong>${Math.min(100, Math.round((totalCards / Math.max(1, units.length * 10)) * 100))}%</strong>
                        </div>
                    </div>
                </section>

                <section class="toolbar panel" data-animate>
                    <div class="search-box">
                        <input id="home-search" type="search" class="search-input" placeholder="Buscar unidad...">
                    </div>
                    <select id="home-sort" aria-label="Ordenar unidades">
                        <option value="recent">Más recientes</option>
                        <option value="title">Título</option>
                        <option value="cards">Más tarjetas</option>
                    </select>
                </section>

                <div id="home-units" class="grid mt-2">
                    ${units.map(u => this.renderUnitCard(u, true)).join('')}
                </div>
            </div>
        `;

        return {
            html,
            attach: () => {
                const searchInput = document.getElementById('home-search');
                const sortSelect = document.getElementById('home-sort');
                const unitList = document.getElementById('home-units');

                const renderFiltered = () => {
                    const q = searchInput.value.trim().toLowerCase();
                    const sortMode = sortSelect.value;
                    const sorted = [...units].sort((a, b) => {
                        if (sortMode === 'title') return (a.title || '').localeCompare(b.title || '');
                        if (sortMode === 'cards') return (b.cards?.length || 0) - (a.cards?.length || 0);
                        return new Date(b.modified || b.created || 0) - new Date(a.modified || a.created || 0);
                    });

                    const filtered = sorted.filter(u => !q || (u.title || '').toLowerCase().includes(q) || (u.description || '').toLowerCase().includes(q));
                    unitList.innerHTML = filtered.length ? filtered.map(u => this.renderUnitCard(u, true)).join('') : '<div class="empty-state" style="grid-column: 1 / -1;">No hay unidades que coincidan con tu búsqueda.</div>';
                    App.bindAnimations();
                    lucide.createIcons();
                };

                searchInput.addEventListener('input', renderFiltered);
                sortSelect.addEventListener('change', renderFiltered);
            }
        };
    },

    async library() {
        const units = await db.getAllUnits();
        const list = units.sort((a, b) => (b.modified || b.created || 0).localeCompare ? (b.modified || b.created || 0).localeCompare(a.modified || a.created || 0) : 0);

        const html = `
            <div class="container page-shell">
                <div class="flex-between mb-2">
                    <h1>Tu Biblioteca</h1>
                    <a href="#/editor/new" class="btn btn-primary"><i data-lucide="plus"></i> Nueva</a>
                </div>
                <section class="toolbar panel" data-animate>
                    <div class="search-box">
                        <input id="library-search" type="search" class="search-input" placeholder="Buscar en la biblioteca...">
                    </div>
                    <select id="library-sort" aria-label="Ordenar biblioteca">
                        <option value="recent">Recientes</option>
                        <option value="title">Título</option>
                        <option value="cards">Más tarjetas</option>
                    </select>
                </section>
                <div id="library-grid" class="grid">
                    ${list.map(u => `
                        <div class="unit-card" data-animate>
                            <h3>${DOMPurify.sanitize(u.title || 'Sin título')}</h3>
                            <p class="text-muted">${(u.cards || []).length} tarjetas</p>
                            <p class="text-muted">${DOMPurify.sanitize(u.description || 'Sin descripción')}</p>
                            <div class="flex-between mt-2">
                                <a href="#/study/${u.id}" class="btn btn-primary" style="flex:1;">Estudiar</a>
                                <a href="#/editor/${u.id}" class="btn btn-secondary btn-icon"><i data-lucide="edit-3"></i></a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        return {
            html,
            attach: () => {
                const searchInput = document.getElementById('library-search');
                const sortSelect = document.getElementById('library-sort');
                const grid = document.getElementById('library-grid');
                const renderFiltered = () => {
                    const q = searchInput.value.trim().toLowerCase();
                    const sortMode = sortSelect.value;
                    const sorted = [...units].sort((a, b) => {
                        if (sortMode === 'title') return (a.title || '').localeCompare(b.title || '');
                        if (sortMode === 'cards') return (b.cards?.length || 0) - (a.cards?.length || 0);
                        return new Date(b.modified || b.created || 0) - new Date(a.modified || a.created || 0);
                    });

                    const filtered = sorted.filter(u => !q || (u.title || '').toLowerCase().includes(q) || (u.description || '').toLowerCase().includes(q));
                    grid.innerHTML = filtered.length ? filtered.map(u => `
                        <div class="unit-card" data-animate>
                            <h3>${DOMPurify.sanitize(u.title || 'Sin título')}</h3>
                            <p class="text-muted">${(u.cards || []).length} tarjetas</p>
                            <p class="text-muted">${DOMPurify.sanitize(u.description || 'Sin descripción')}</p>
                            <div class="flex-between mt-2">
                                <a href="#/study/${u.id}" class="btn btn-primary" style="flex:1;">Estudiar</a>
                                <a href="#/editor/${u.id}" class="btn btn-secondary btn-icon"><i data-lucide="edit-3"></i></a>
                            </div>
                        </div>
                    `).join('') : '<div class="empty-state" style="grid-column: 1 / -1;">No se encontraron unidades.</div>';
                    App.bindAnimations();
                    lucide.createIcons();
                };

                searchInput.addEventListener('input', renderFiltered);
                sortSelect.addEventListener('change', renderFiltered);
            }
        };
    },

    async studyHome(id) {
        const unit = await db.getUnit(id);
        if (!unit) return { html: `<div class="container">Unidad no encontrada</div>`, attach: () => {} };

        const html = `
            <div class="container text-center page-shell">
                <div class="hero-panel" data-animate>
                    <p class="text-muted">Unidad activa</p>
                    <h1 class="mt-2">${DOMPurify.sanitize(unit.title)}</h1>
                    <p class="text-muted">${DOMPurify.sanitize(unit.description || 'Sin descripción')}</p>
                    <p class="text-muted mt-1">${unit.cards.length} tarjetas</p>
                </div>

                <div class="grid mt-3">
                    <a href="#/play/${id}/flashcards" class="unit-card text-center" data-animate>
                        <i data-lucide="layers" style="margin: 0 auto; color: var(--primary);"></i>
                        <h3>Fichas</h3>
                    </a>
                    <a href="#/play/${id}/learn" class="unit-card text-center" data-animate>
                        <i data-lucide="brain" style="margin: 0 auto; color: var(--primary);"></i>
                        <h3>Aprender</h3>
                    </a>
                    <a href="#/play/${id}/test" class="unit-card text-center" data-animate>
                        <i data-lucide="file-check" style="margin: 0 auto; color: var(--primary);"></i>
                        <h3>Probar</h3>
                    </a>
                    <a href="#/play/${id}/match" class="unit-card text-center" data-animate>
                        <i data-lucide="gamepad-2" style="margin: 0 auto; color: var(--primary);"></i>
                        <h3>Emparejar</h3>
                    </a>
                </div>

                <div class="flex-between mt-3" style="justify-content: center; gap: 1rem; flex-wrap: wrap;">
                    <a href="#/editor/${id}" class="btn btn-secondary"><i data-lucide="edit"></i> Editar</a>
                    <button id="export-unit-btn" class="btn btn-secondary"><i data-lucide="share-2"></i> Exportar</button>
                    <button id="delete-unit-btn" class="btn btn-danger"><i data-lucide="trash"></i> Eliminar</button>
                </div>
            </div>
        `;

        return {
            html,
            attach: () => {
                document.getElementById('export-unit-btn').addEventListener('click', async () => {
                    App.showToast("Exportando archivo .locallearn...");
                    try {
                        await Format.createLocallearnFile(id);
                        App.showToast("Archivo exportado", 'success');
                    } catch (e) {
                        App.showToast("Error al exportar", 'error');
                    }
                });

                document.getElementById('delete-unit-btn').addEventListener('click', () => {
                    App.showModal({
                        title: "¿Eliminar unidad?",
                        body: "Esta acción no se puede deshacer.",
                        confirmText: "Eliminar",
                        onConfirm: async () => {
                            await db.deleteUnit(id);
                            App.showToast("Unidad eliminada", 'success');
                            window.location.hash = '/library';
                        }
                    });
                });
            }
        };
    },

    async importView() {
        const html = `
            <div class="container page-shell">
                <h1>Importar</h1>
                <div class="card-editor-item mt-2" data-animate>
                    <h3>Archivo Local Learn (.locallearn)</h3>
                    <p class="text-muted mt-1 mb-2">Abre un paquete zip con extensión locallearn.</p>
                    <input type="file" id="file-input" accept=".locallearn,.zip" style="display:none;">
                    <button class="btn btn-secondary" onclick="document.getElementById('file-input').click()">Seleccionar Archivo</button>
                </div>

                <div class="card-editor-item mt-2" data-animate>
                    <h3>Importar de Quizlet (Texto)</h3>
                    <p class="text-muted mt-1 mb-2">Pega el texto copiado de Quizlet (Término [TAB] Definición).</p>
                    <textarea id="quizlet-text" class="form-control" rows="5" placeholder="Término\tDefinición..."></textarea>
                    <button id="quizlet-btn" class="btn btn-primary mt-1">Importar Texto</button>
                </div>
            </div>
        `;

        return {
            html,
            attach: () => {
                document.getElementById('file-input').addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    App.showToast("Procesando paquete...");
                    try {
                        const id = await Format.importLocallearn(file);
                        App.showToast("Importado con éxito", 'success');
                        window.location.hash = `/study/${id}`;
                    } catch (err) {
                        App.showToast(err.message || 'No se pudo importar', 'error');
                    }
                });

                document.getElementById('quizlet-btn').addEventListener('click', async () => {
                    const txt = document.getElementById('quizlet-text').value;
                    if (!txt) return;
                    try {
                        const unit = Format.importQuizletText(txt);
                        await db.saveUnit(unit);
                        App.showToast("Importado correctamente", 'success');
                        window.location.hash = `/study/${unit.id}`;
                    } catch (err) {
                        App.showToast(err.message || 'No se pudo importar', 'error');
                    }
                });
            }
        };
    },

    async settings() {
        const units = await db.getAllUnits();
        const totalCards = units.reduce((sum, unit) => sum + (unit.cards?.length || 0), 0);
        const html = `
            <div class="container page-shell">
                <h1>Ajustes</h1>
                <div class="card-editor-item mt-2" data-animate>
                    <h3>Tu progreso</h3>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="text-muted">Unidades</span>
                            <strong>${units.length}</strong>
                        </div>
                        <div class="stat-card">
                            <span class="text-muted">Tarjetas</span>
                            <strong>${totalCards}</strong>
                        </div>
                    </div>
                </div>
                <div class="card-editor-item mt-2" data-animate>
                    <h3>Personalización</h3>
                    <p class="text-muted mt-1 mb-2">Cambia el tema para una experiencia más cómoda.</p>
                    <button id="theme-toggle-btn" class="btn btn-secondary"><i data-lucide="sun-moon"></i> Cambiar tema</button>
                </div>
                <div class="card-editor-item mt-2" data-animate>
                    <h3>Almacenamiento Local</h3>
                    <p class="text-muted mt-1 mb-2">Elimina todas las unidades y progresos guardados en este navegador.</p>
                    <div class="flex-between" style="gap: 0.75rem; flex-wrap: wrap; justify-content: flex-start;">
                        <button id="export-all-btn" class="btn btn-secondary"><i data-lucide="download"></i> Exportar todo</button>
                        <button id="clear-data-btn" class="btn btn-danger"><i data-lucide="trash"></i> Borrar Todo</button>
                    </div>
                </div>
            </div>
        `;

        return {
            html,
            attach: () => {
                document.getElementById('theme-toggle-btn').addEventListener('click', () => {
                    const next = App.toggleTheme();
                    App.showToast(next === 'dark' ? 'Tema oscuro' : 'Tema claro', 'success');
                });

                document.getElementById('export-all-btn').addEventListener('click', async () => {
                    const units = await db.getAllUnits();
                    const blob = new Blob([JSON.stringify(units, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'locallearn-backup.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    App.showToast('Copia de seguridad exportada', 'success');
                });

                document.getElementById('clear-data-btn').addEventListener('click', () => {
                    App.showModal({
                        title: "¿Borrar todos los datos?",
                        body: "Se eliminarán permanentemente todas las unidades y tu progreso local.",
                        confirmText: "Borrar Todo",
                        onConfirm: async () => {
                            await db.clearAllData();
                            App.showToast("Datos borrados", 'success');
                            window.location.hash = '/home';
                        }
                    });
                });
            }
        };
    }
};