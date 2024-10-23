app.get('/liens', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'liens.html'));
});

app.post('/liens', (req, res) => {
    db.all('SELECT original_url, short_url, visit, created_at FROM urls', (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Erreur serveur', error: err.message });
        }
        return res.json({
            message: "Liste des liens:",
            liens: rows.map(row => ({
                original_url: row.original_url,
                short_url: row.short_url,
                visit: row.visit,
                created_at: row.created_at
            }))
        });
    });
});
