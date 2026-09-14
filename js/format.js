const Format = {
    async createLocallearnFile(unitId) {
        const unit = await db.getUnit(unitId);
        if (!unit) throw new Error("Unidad no encontrada");

        const zip = new JSZip();
        const exportData = JSON.parse(JSON.stringify(unit));
        zip.file("pack.json", JSON.stringify(exportData, null, 2));

        const mediaFolder = zip.folder("media");
        for (const card of unit.cards) {
            if (card.image) {
                const blob = await db.getMediaBlob(`${unit.id}_${card.image}`);
                if (blob) {
                    const cleanName = card.image.replace(/^media\//, '');
                    mediaFolder.file(cleanName, blob);
                }
            }
        }

        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
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
            const packFile = zip.file("pack.json");
            if (!packFile) throw new Error("No es un archivo .locallearn válido.");

            const packJsonStr = await packFile.async("string");
            const pack = JSON.parse(packJsonStr);

            if (pack.format !== 'locallearn') {
                throw new Error("Formato incompatible.");
            }

            pack.id = pack.id || `unit-${Date.now()}`;

            const mediaFolder = zip.folder("media");
            if (mediaFolder) {
                const files = mediaFolder.file(/.*\.*/);
                for (const mFile of files) {
                    const blob = await mFile.async("blob");
                    const relativePath = `media/${mFile.name.split('/').pop()}`;
                    await db.saveMedia(`${pack.id}_${relativePath}`, blob);
                }
            }

            await db.saveUnit(pack);
            return pack.id;
        } catch (error) {
            console.error(error);
            throw new Error("No se pudo importar: archivo corrupto o inválido.");
        }
    },

    importQuizletText(text, title) {
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        const cards = [];

        lines.forEach((line, idx) => {
            let parts = line.split('\t');
            if (parts.length < 2) parts = line.split(',');
            if (parts.length >= 2) {
                cards.push({
                    id: `card-${Date.now()}-${idx}`,
                    term: parts[0].trim(),
                    definition: parts.slice(1).join(' ').trim(),
                    distractors: []
                });
            }
        });

        if (cards.length === 0) throw new Error("No se detectaron términos válidos.");

        return {
            format: "locallearn",
            version: 1,
            id: `unit-${Date.now()}`,
            title: title || "Unidad Importada",
            description: "Importado mediante texto plano",
            author: "Usuario Local",
            created: new Date().toISOString(),
            cards
        };
    },

    exportToTSV(unit) {
        return unit.cards.map(c => `${c.term}\t${c.definition}`).join('\n');
    }
};