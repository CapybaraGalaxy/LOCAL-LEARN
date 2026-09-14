const Editor = {
    activeUnit: null,

    async render(unitId) {
        if (unitId === 'new') {
            this.activeUnit = {
                format: "locallearn",
                version: 1,
                id: `unit-${Date.now()}`,
                title: "",
                description: "",
                author: "Usuario Local",
                created: new Date().toISOString(),
                cards: []
            };
        } else {
            const existing = await db.getUnit(unitId);
            this.activeUnit = existing ? JSON.parse(JSON.stringify(existing)) : null;
        }

        if (!this.activeUnit) return { html: `<div class="container">Error al cargar editor</div>`, attach: () => {} };

        const html = `
            <div class="container">
                <div class="flex-between mb-2">
                    <h1>${unitId === 'new' ? 'Nueva Unidad' : 'Editar Unidad'}</h1>
                    <button id="editor-save-btn" class="btn btn-primary"><i data-lucide="save"></i> Guardar</button>
                </div>

                <div class="editor-card mb-2" style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md);">
                    <div class="form-group">
                        <label class="form-label">Título</label>
                        <input type="text" id="unit-title" class="form-control" value="${DOMPurify.sanitize(this.activeUnit.title)}" placeholder="Ej. Biología Celular">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Descripción</label>
                        <textarea id="unit-desc" class="form-control" rows="2" placeholder="Notas sobre el tema...">${DOMPurify.sanitize(this.activeUnit.description || '')}</textarea>
                    </div>
                </div>

                <div class="flex-between mb-2">
                    <h2>Tarjetas (${this.activeUnit.cards.length})</h2>
                    <button id="add-card-btn" class="btn btn-secondary"><i data-lucide="plus"></i> Añadir Tarjeta</button>
                </div>

                <div id="cards-container">
                    ${this.renderCardItems()}
                </div>
            </div>
        `;

        return { html, attach: () => this.attachEvents() };
    },

    renderCardItems() {
        if (this.activeUnit.cards.length === 0) {
            return `<p class="text-muted text-center" style="padding: 2rem;">No hay tarjetas en esta unidad. Haz clic en "Añadir Tarjeta".</p>`;
        }

        return this.activeUnit.cards.map((card, idx) => `
            <div class="card-editor-item" data-index="${idx}">
                <div class="card-editor-header">
                    <span class="text-muted font-weight-bold">#${idx + 1}</span>
                    <div class="flex-between gap-1">
                        <button class="btn-icon move-up-btn" ${idx === 0 ? 'disabled' : ''}><i data-lucide="arrow-up"></i></button>
                        <button class="btn-icon move-down-btn" ${idx === this.activeUnit.cards.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down"></i></button>
                        <button class="btn-icon delete-card-btn" style="color: var(--danger);"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Término</label>
                    <input type="text" class="form-control card-term" value="${DOMPurify.sanitize(card.term)}" placeholder="Término">
                </div>
                <div class="form-group">
                    <label class="form-label">Definición</label>
                    <textarea class="form-control card-def" rows="2" placeholder="Definición">${DOMPurify.sanitize(card.definition)}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Distractores para Modo Aprender (Opcional, separados por coma)</label>
                    <input type="text" class="form-control card-distractors" value="${DOMPurify.sanitize((card.distractors || []).join(', '))}" placeholder="Distractor 1, Distractor 2">
                </div>
            </div>
        `).join('');
    },

    attachEvents() {
        const container = document.getElementById('cards-container');

        document.getElementById('add-card-btn').addEventListener('click', () => {
            this.syncState();
            this.activeUnit.cards.push({
                id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                term: "",
                definition: "",
                distractors: []
            });
            container.innerHTML = this.renderCardItems();
            lucide.createIcons();
            this.attachEvents();
        });

        document.getElementById('editor-save-btn').addEventListener('click', async () => {
            this.syncState();
            this.activeUnit.title = document.getElementById('unit-title').value.trim();
            this.activeUnit.description = document.getElementById('unit-desc').value.trim();

            if (!this.activeUnit.title) {
                App.showToast("El título es obligatorio");
                return;
            }

            await db.saveUnit(this.activeUnit);
            App.showToast("Unidad guardada con éxito");
            window.location.hash = `/study/${this.activeUnit.id}`;
        });

        container.querySelectorAll('.delete-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.closest('.card-editor-item').dataset.index);
                this.syncState();
                this.activeUnit.cards.splice(idx, 1);
                container.innerHTML = this.renderCardItems();
                lucide.createIcons();
                this.attachEvents();
            });
        });

        container.querySelectorAll('.move-up-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.closest('.card-editor-item').dataset.index);
                if (idx > 0) {
                    this.syncState();
                    const temp = this.activeUnit.cards[idx];
                    this.activeUnit.cards[idx] = this.activeUnit.cards[idx - 1];
                    this.activeUnit.cards[idx - 1] = temp;
                    container.innerHTML = this.renderCardItems();
                    lucide.createIcons();
                    this.attachEvents();
                }
            });
        });

        container.querySelectorAll('.move-down-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.closest('.card-editor-item').dataset.index);
                if (idx < this.activeUnit.cards.length - 1) {
                    this.syncState();
                    const temp = this.activeUnit.cards[idx];
                    this.activeUnit.cards[idx] = this.activeUnit.cards[idx + 1];
                    this.activeUnit.cards[idx + 1] = temp;
                    container.innerHTML = this.renderCardItems();
                    lucide.createIcons();
                    this.attachEvents();
                }
            });
        });
    },

    syncState() {
        const items = document.querySelectorAll('.card-editor-item');
        items.forEach((item, idx) => {
            if (this.activeUnit.cards[idx]) {
                this.activeUnit.cards[idx].term = item.querySelector('.card-term').value;
                this.activeUnit.cards[idx].definition = item.querySelector('.card-def').value;
                const rawDist = item.querySelector('.card-distractors').value;
                this.activeUnit.cards[idx].distractors = rawDist.split(',').map(s => s.trim()).filter(Boolean);
            }
        });
    }
};