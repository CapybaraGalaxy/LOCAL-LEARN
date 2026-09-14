const Engine = {
    // Normalizador estricto de respuestas escritas
    normalizeText(text) {
        if (!text) return "";
        return text
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "") // Quitar puntuación
            .replace(/\s+/g, " ") // Espacios dobles
            .trim();
    },

    // MODO FLASHCARDS
    renderFlashcards(unit) {
        let currentIndex = 0;
        let isFlipped = false;

        const render = () => {
            const card = unit.cards[currentIndex];
            const safeTerm = DOMPurify.sanitize(card.term);
            const safeDef = DOMPurify.sanitize(card.definition);

            return `
                <div class="container text-center max-w-md">
                    <div class="flex-between">
                        <a href="#/study/${unit.id}" class="btn-icon"><i data-lucide="x"></i></a>
                        <span class="text-muted">${currentIndex + 1} / ${unit.cards.length}</span>
                        <div></div>
                    </div>

                    <div class="flashcard-container" id="fc-click-area">
                        <div class="flashcard ${isFlipped ? 'flipped' : ''}">
                            <div class="flashcard-face flashcard-front">
                                <h2>${safeTerm}</h2>
                                <p class="text-muted mt-2" style="font-size: 0.8rem;">Haz clic para voltear</p>
                            </div>
                            <div class="flashcard-face flashcard-back">
                                <h2>${safeDef}</h2>
                            </div>
                        </div>
                    </div>

                    <div class="rating-bar mb-2">
                        <button class="btn btn-secondary rate-btn" data-level="1" style="color: var(--danger);">Difícil</button>
                        <button class="btn btn-secondary rate-btn" data-level="2" style="color: var(--warning);">Bien</button>
                        <button class="btn btn-secondary rate-btn" data-level="3" style="color: var(--success);">Fácil</button>
                    </div>

                    <div class="flex-between">
                        <button class="btn btn-secondary" id="fc-prev" ${currentIndex === 0 ? 'disabled' : ''}><i data-lucide="chevron-left"></i> Anterior</button>
                        <button class="btn btn-secondary" id="fc-shuffle"><i data-lucide="shuffle"></i> Barajar</button>
                        <button class="btn btn-secondary" id="fc-next" ${currentIndex === unit.cards.length - 1 ? 'disabled' : ''}>Siguiente <i data-lucide="chevron-right"></i></button>
                    </div>
                </div>
            `;
        };

        const attach = () => {
            document.getElementById('fc-click-area').addEventListener('click', () => {
                isFlipped = !isFlipped;
                App.renderView();
            });

            document.querySelectorAll('.rate-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const level = parseInt(btn.dataset.level);
                    await db.saveCardProgress(unit.id, unit.cards[currentIndex].id, { level });
                    App.showToast("Progreso registrado");
                    if (currentIndex < unit.cards.length - 1) {
                        currentIndex++;
                        isFlipped = false;
                        App.renderView();
                    }
                });
            });

            document.getElementById('fc-prev').addEventListener('click', () => {
                if (currentIndex > 0) { currentIndex--; isFlipped = false; App.renderView(); }
            });
            document.getElementById('fc-next').addEventListener('click', () => {
                if (currentIndex < unit.cards.length - 1) { currentIndex++; isFlipped = false; App.renderView(); }
            });
            document.getElementById('fc-shuffle').addEventListener('click', () => {
                unit.cards.sort(() => Math.random() - 0.5);
                currentIndex = 0;
                isFlipped = false;
                App.renderView();
            });
        };

        return { render, attach, cleanup: () => {} };
    },

    // MODO APRENDER (LEARN ADAPTATIVO)
    renderLearn(unit) {
        let queue = [...unit.cards].sort(() => Math.random() - 0.5);
        let currentCard = queue[0];
        let step = 'question'; // 'question' | 'feedback'
        let isCorrect = false;
        let selectedOption = "";

        const render = () => {
            if (queue.length === 0) {
                return `
                    <div class="container text-center">
                        <h2>¡Modo Aprender Completado!</h2>
                        <p class="text-muted mt-1">Has dominado todos los términos de esta sesión.</p>
                        <a href="#/study/${unit.id}" class="btn btn-primary mt-3">Volver a la unidad</a>
                    </div>
                `;
            }

            currentCard = queue[0];
            const isPhase2Written = (currentCard.masteryLevel || 0) >= 2;
            const safeTerm = DOMPurify.sanitize(currentCard.term);

            let contentHtml = "";

            if (!isPhase2Written) {
                // Opción múltiple
                let options = (currentCard.distractors || []).slice(0, 3);
                if (options.length < 3) {
                    const pool = unit.cards.filter(c => c.id !== currentCard.id).map(c => c.definition);
                    while (options.length < 3 && pool.length > 0) {
                        const rand = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
                        if (!options.includes(rand)) options.push(rand);
                    }
                }
                options.push(currentCard.definition);
                options.sort(() => Math.random() - 0.5);

                contentHtml = `
                    <div class="options-grid mt-2">
                        ${options.map(opt => {
                            let btnClass = "option-btn";
                            if (step === 'feedback') {
                                if (opt === currentCard.definition) btnClass += " correct";
                                else if (opt === selectedOption) btnClass += " wrong";
                            }
                            return `<button class="${btnClass}" data-ans="${DOMPurify.sanitize(opt)}">${DOMPurify.sanitize(opt)}</button>`;
                        }).join('')}
                    </div>
                `;
            } else {
                // Escritura
                contentHtml = `
                    <div class="mt-2">
                        <input type="text" id="written-ans" class="form-control" placeholder="Escribe la definición..." ${step === 'feedback' ? 'disabled' : ''}>
                        <button id="submit-written-btn" class="btn btn-primary mt-1" style="width: 100%;" ${step === 'feedback' ? 'style="display:none;"' : ''}>Comprobar</button>
                    </div>
                `;
            }

            return `
                <div class="container max-w-md">
                    <div class="flex-between mb-2">
                        <a href="#/study/${unit.id}" class="btn-icon"><i data-lucide="x"></i></a>
                        <span class="text-muted">Restantes: ${queue.length}</span>
                    </div>

                    <div class="editor-card text-center" style="padding: 2rem;">
                        <span class="text-muted" style="font-size: 0.8rem;">${isPhase2Written ? 'FASE 2: ESCRITURA' : 'FASE 1: RECONOCIMIENTO'}</span>
                        <h2 class="mt-1">${safeTerm}</h2>
                    </div>

                    ${contentHtml}

                    ${step === 'feedback' ? `
                        <div class="mt-2 text-center">
                            <p style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                                ${isCorrect ? '¡Correcto!' : 'Incorrecto. Respuesta: ' + DOMPurify.sanitize(currentCard.definition)}
                            </p>
                            <button id="learn-next-btn" class="btn btn-primary mt-1" style="width:100%;">Continuar</button>
                        </div>
                    ` : ''}
                </div>
            `;
        };

        const attach = () => {
            if (queue.length === 0) return;

            if (step === 'question') {
                document.querySelectorAll('.option-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        selectedOption = e.target.dataset.ans;
                        isCorrect = (selectedOption === currentCard.definition);
                        await processAnswer(isCorrect);
                    });
                });

                const submitWritten = document.getElementById('submit-written-btn');
                if (submitWritten) {
                    submitWritten.addEventListener('click', async () => {
                        const val = document.getElementById('written-ans').value;
                        const normInput = Engine.normalizeText(val);
                        const normTarget = Engine.normalizeText(currentCard.definition);
                        
                        const accepted = (currentCard.acceptedAnswers || []).map(a => Engine.normalizeText(a));
                        isCorrect = (normInput === normTarget) || accepted.includes(normInput);
                        await processAnswer(isCorrect);
                    });
                }
            } else {
                document.getElementById('learn-next-btn').addEventListener('click', () => {
                    step = 'question';
                    App.renderView();
                });
            }
        };

        const processAnswer = async (correct) => {
            step = 'feedback';
            currentCard.masteryLevel = currentCard.masteryLevel || 0;

            if (correct) {
                currentCard.masteryLevel += 1;
                await db.saveCardProgress(unit.id, currentCard.id, { level: currentCard.masteryLevel });
                queue.shift(); // Sale de la cola
            } else {
                currentCard.masteryLevel = 0;
                await db.saveCardProgress(unit.id, currentCard.id, { level: 0 });
                queue.push(queue.shift()); // Reaparece al final de la cola
            }
            App.renderView();
        };

        return { render, attach, cleanup: () => {} };
    },

    // MODO TEST (EXAMEN)
    renderTest(unit) {
        let isSubmitted = false;
        let score = 0;
        const questions = unit.cards.map(c => {
            const distractors = unit.cards.filter(o => o.id !== c.id).map(o => o.definition);
            distractors.sort(() => Math.random() - 0.5);
            const options = [c.definition, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
            return {
                cardId: c.id,
                term: c.term,
                correctDefinition: c.definition,
                options,
                userAnswer: null
            };
        }).sort(() => Math.random() - 0.5);

        const render = () => {
            if (isSubmitted) {
                return `
                    <div class="container max-w-md text-center">
                        <h1>Resultado del Test</h1>
                        <div style="font-size: 3rem; font-weight: 700; color: var(--primary); margin: 1rem 0;">
                            ${Math.round((score / questions.length) * 100)}%
                        </div>
                        <p class="text-muted">${score} de ${questions.length} respuestas correctas</p>
                        <a href="#/study/${unit.id}" class="btn btn-primary mt-3">Volver a la unidad</a>
                    </div>
                `;
            }

            return `
                <div class="container max-w-md">
                    <div class="flex-between mb-2">
                        <a href="#/study/${unit.id}" class="btn-icon"><i data-lucide="x"></i></a>
                        <h2>Examen de prueba</h2>
                    </div>

                    ${questions.map((q, idx) => `
                        <div class="editor-card mb-2">
                            <p class="text-muted font-weight-bold">Pregunta ${idx + 1}</p>
                            <h3 class="mb-2">${DOMPurify.sanitize(q.term)}</h3>
                            ${q.options.map(opt => `
                                <button class="option-btn test-opt ${q.userAnswer === opt ? 'selected' : ''}" data-q="${idx}" data-val="${DOMPurify.sanitize(opt)}">
                                    ${DOMPurify.sanitize(opt)}
                                </button>
                            `).join('')}
                        </div>
                    `).join('')}

                    <button id="submit-test-btn" class="btn btn-primary mt-2" style="width: 100%;">Finalizar Examen</button>
                </div>
            `;
        };

        const attach = () => {
            if (isSubmitted) return;

            document.querySelectorAll('.test-opt').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const qIdx = parseInt(e.target.dataset.q);
                    const val = e.target.dataset.val;
                    questions[qIdx].userAnswer = val;
                    document.querySelectorAll(`.test-opt[data-q="${qIdx}"]`).forEach(b => b.classList.remove('selected'));
                    e.target.classList.add('selected');
                });
            });

            document.getElementById('submit-test-btn').addEventListener('click', async () => {
                score = 0;
                questions.forEach(q => {
                    if (q.userAnswer === q.correctDefinition) score++;
                });
                isSubmitted = true;
                await db.saveRecord(unit.id, 'test', { score, total: questions.length, date: Date.now() });
                App.renderView();
            });
        };

        return { render, attach, cleanup: () => {} };
    },

    // MODO MATCH (EMPAREJAR)
    renderMatch(unit) {
        let items = [];
        let selected = null;
        let matchesCount = 0;
        let errors = 0;
        let startTime = Date.now();
        let isFinished = false;

        // Seleccionar 6 tarjetas
        const pool = [...unit.cards].sort(() => Math.random() - 0.5).slice(0, 6);
        pool.forEach(c => {
            items.push({ id: c.id, text: c.term, type: 'term' });
            items.push({ id: c.id, text: c.definition, type: 'def' });
        });
        items.sort(() => Math.random() - 0.5);

        const render = () => {
            if (isFinished) {
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                return `
                    <div class="container text-center">
                        <h1>¡Emparejamiento Completado!</h1>
                        <p class="text-muted mt-1">Tiempo: ${totalTime}s | Errores: ${errors}</p>
                        <a href="#/study/${unit.id}" class="btn btn-primary mt-3">Volver a la unidad</a>
                    </div>
                `;
            }

            return `
                <div class="container">
                    <div class="flex-between mb-2">
                        <a href="#/study/${unit.id}" class="btn-icon"><i data-lucide="x"></i></a>
                        <h2>Combinar</h2>
                        <span></span>
                    </div>
                    <div class="match-grid">
                        ${items.map((it, idx) => `
                            <div class="match-card ${it.matched ? 'matched' : ''} ${selected === idx ? 'selected' : ''}" data-idx="${idx}">
                                ${DOMPurify.sanitize(it.text)}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const attach = () => {
            if (isFinished) return;

            document.querySelectorAll('.match-card').forEach(cardEl => {
                cardEl.addEventListener('click', async (e) => {
                    const idx = parseInt(e.target.dataset.idx);
                    if (items[idx].matched) return;

                    if (selected === null) {
                        selected = idx;
                        App.renderView();
                    } else if (selected === idx) {
                        selected = null;
                        App.renderView();
                    } else {
                        const first = items[selected];
                        const second = items[idx];

                        if (first.id === second.id && first.type !== second.type) {
                            first.matched = true;
                            second.matched = true;
                            matchesCount++;
                            selected = null;

                            if (matchesCount === pool.length) {
                                isFinished = true;
                                const time = ((Date.now() - startTime) / 1000);
                                await db.saveRecord(unit.id, 'match', { time, errors, date: Date.now() });
                            }
                            App.renderView();
                        } else {
                            errors++;
                            e.target.classList.add('error');
                            setTimeout(() => {
                                selected = null;
                                App.renderView();
                            }, 400);
                        }
                    }
                });
            });
        };

        return { render, attach, cleanup: () => {} };
    }
};