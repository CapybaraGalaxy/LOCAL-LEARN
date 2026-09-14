const Format = {
    async createLocallearnFile(unitId) {
        const unit = await db.getUnit(unitId);
        if (!unit) throw new Error("Unidad no encontrada");

        const zip = new JSZip();
        
        // Limpiamos datos de interfaz antes de exportar
        const exportData = JSON.parse(JSON.stringify(unit));
        
        zip.file("pack.json", JSON.stringify(exportData, null, 2));

        // Empaquetar imágenes asociadas
        const mediaFolder = zip.folder("media");
        for (const card of unit.cards) {
            if (card.image) {
                const blob = await db.getMediaBlob(`${unit.id}_${card.image}`);
                if (blob) {
                    mediaFolder.file(card.image.replace('media/', ''), blob);
                }
            }
        }

        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        
        // Descargar
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${unit.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.locallearn`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },

    async importLocallearn(file) {
        try {
            const zip = await JSZip.loadAsync(file);
            const packJsonStr = await zip.file("pack.json").async("string");
            const pack = JSON.parse(packJsonStr);

            if (pack.format !== 'locallearn') {
                throw new Error("Formato inválido. No es un archivo locallearn.");
            }

            // Validar e inyectar ID si existe conflicto (V1 simple overwrite/new id)
            pack.id = pack.id || `unit-${Date.now()}`;
            
            // Extraer y guardar imágenes
            if (zip.folder("media")) {
                const mediaFiles = zip.folder("media").file(/.*\.*/);
                for (const mFile of mediaFiles) {
                    const blob = await mFile.async("blob");
                    await db.saveMedia(`${pack.id}_media/${mFile.name}`, blob);
                }
            }

            await db.saveUnit(pack);
            return pack.id;
        } catch (error) {
            console.error(error);
            throw new Error("El archivo está corrupto o es incompatible.");
        }
    },

    importQuizletText(text, title) {
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const cards = [];
        
        lines.forEach((line, index) => {
            const parts = line.split('\t');
            if (parts.length >= 2) {
                cards.push({
                    id: `c-${Date.now()}-${index}`,
                    term: parts[0].trim(),
                    definition: parts[1].trim()
                });
            }
        });

        if (cards.length === 0) throw new Error("No se detectaron términos. Asegúrate de usar tabulaciones.");

        return {
            format: "locallearn",
            version: 1,
            id: `unit-${Date.now()}`,
            title: title || "Importación de texto",
            created: new Date().toISOString(),
            cards: cards
        };
    }
};