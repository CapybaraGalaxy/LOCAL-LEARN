const Engine = {
    async initStudySession(unitId) {
        const unit = await db.getUnit(unitId);
        const progress = await db.getUnitProgress(unitId);
        return { unit, progress };
    },

    // Modo Flashcards Clásico
    renderFlashcards(unit) {
        let currentIndex = 0;
        let isFlipped = false;
        
        const render = () => {
            const card = unit.cards[currentIndex];
            const safeTerm = DOMPurify.sanitize(card.term);
            const safeDef = DOMPurify.sanitize(card.definition);

            return `
                <div class="container text-center">
                    <p class="text-muted">Tarjeta ${currentIndex + 1} de ${unit.cards.length}</p>
                    <div class="flashcard-container" id="fc-container">
                        <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="fc-card">
                            <div class="flashcard-face flashcard-front">
                                <h2>${safeTerm}</h2>
                            </div>
                            <div class="flashcard-face flashcard-back">
                                <h2>${safeDef}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="flashcard-controls">
                        <button class="btn btn-secondary" id="fc-prev"><i data-lucide="arrow-left"></i></button>
                        <button class="btn btn-primary" id="fc-flip">Voltear</button>
                        <button class="btn btn-secondary" id="fc-next"><i data-lucide="arrow-right"></i></button>
                    </div>
                </div>
            `;
        };

        const attach = () => {
            document.getElementById('fc-container').addEventListener('click', () => {
                isFlipped = !isFlipped;
                App.renderView(); // Re-render rápido
            });
            document.getElementById('fc-flip').addEventListener('click', () => {
                isFlipped = !isFlipped;
                App.renderView();
            });
            document.getElementById('fc-prev').addEventListener('click', () => {
                if (currentIndex > 0) { currentIndex--; isFlipped = false; App.renderView(); }
            });
            document.getElementById('fc-next').addEventListener('click', () => {
                if (currentIndex < unit.cards.length - 1) { currentIndex++; isFlipped = false; App.renderView(); }
            });
        };

        return { render, attach };
    },

    // Modo Aprender (Learn) adaptativo básico V1
    renderLearn(unit) {
        // En V1, barajamos y obligamos a acertar
        let queue = [...unit.cards].sort(() => Math.random() - 0.5);
        let currentCard = queue[0];
        let step = 'question'; // 'question' | 'feedback'
        let lastResult = null;

        const render = () => {
            if (queue.length === 0) {
                return `<div class="container text-center">
                            <h2>¡Unidad completada!</h2>
                            <p>Has repasado todos los términos.</p>
                            <a href="#/study/${unit.id}" class="btn btn-primary mt-2">Volver</a>
                        </div>`;
            }

            currentCard = queue[0];
            const safeTerm = DOMPurify.sanitize(currentCard.term);

            // Generar distractores (3 aleatorios + la correcta)
            let options = unit.cards.filter(c => c.id !== currentCard.id)
                              .sort(() => 0.5 - Math.random()).slice(0, 3)
                              .map(c => c.definition);
            options.push(currentCard.definition);
            options.sort(() => 0.5 - Math.random());

            let html = `<div class="container max-w-md">
                <div class="card-header"><span class="text-muted">Quedan ${queue.length} términos</span></div>
                <h2 style="margin: 2rem 0; text-align: center;">${safeTerm}</h2>
                <div class="options-grid">
            `;

            options.forEach((opt, idx) => {
                const safeOpt = DOMPurify.sanitize(opt);
                let btnClass = "option-btn";
                if (step === 'feedback') {
                    if (opt === currentCard.definition) btnClass += " correct";
                    else if (opt === lastResult) btnClass += " wrong";
                }
                html += `<button class="${btnClass}" data-ans="${idx}">${safeOpt}</button>`;
            });

            if (step === 'feedback') {
                html += `<button class="btn btn-primary" id="learn-next" style="width: 100%; margin-top: 1rem;">Continuar</button>`;
            }

            html += `</div></div>`;
            return html;
        };

        const attach = () => {
            if (queue.length === 0) return;
            
            if (step === 'question') {
                document.querySelectorAll('.option-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const ansHtml = e.target.innerHTML;
                        lastResult = ansHtml;
                        step = 'feedback';
                        
                        // Evaluar y guardar progreso
                        const isCorrect = ansHtml === DOMPurify.sanitize(currentCard.definition);
                        const progress = await db.getCardProgress(unit.id, currentCard.id) || { level: 0 };
                        
                        if (isCorrect) {
                            await db.saveCardProgress(unit.id, currentCard.id, { level: Math.min(progress.level + 1, 4) });
                            queue.shift(); // Sale de la cola
                        } else {
                            await db.saveCardProgress(unit.id, currentCard.id, { level: 0 });
                            queue.push(queue.shift()); // Al final de la cola
                        }
                        
                        App.renderView();
                    });
                });
            } else {
                document.getElementById('learn-next').addEventListener('click', () => {
                    step = 'question';
                    App.renderView();
                });
            }
        };

        return { render, attach };
    }
};