require('dotenv').config();

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
const db = new sqlite3.Database(process.env.DB_FILE);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, short_url TEXT, original_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, visit INTEGER)");
});

const port = process.env.PORT || 8080;

app.get('/api/nbliens', (req, res) => {
    db.get("SELECT COUNT(original_url) AS nb FROM urls", (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Erreur base de donnée', error: err.message });
        }

        // res.sendFile(path.join(__dirname, 'public', 'index.html'));
        return res.json({
            nbliens: row.nb
        });
    });
});

async function checkUrl(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' }); // On utilise HEAD pour ne pas récupérer le corps de la réponse
        if (response.ok) {
            console.log(`L'URL ${url} est accessible et renvoie ${response.status}`);
            return true; // URL valide
        } else {
            console.log(`L'URL ${url} a renvoyé une erreur : ${response.status}`);
            return false; // URL invalide
        }
    } catch (error) {
        console.error(`Erreur lors de l'accès à l'URL ${url} : ${error.message}`);
        return false; // URL invalide
    }
}

app.post('/', (req, res) => {
    const url = req.body.url;
    if (!url) {
        return res.status(400).json({ message: 'URL requise.' });
    }
     
    db.get("SELECT * FROM urls WHERE original_url=?", [url], async (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Erreur serveur', error: err.message });
        }

        if (row) {
            //L'URL existe déjà
            db.get('SELECT COUNT(*) AS nb FROM urls', (err, countRow) => {
                if (err) {
                    return res.status(404).json({ message: 'erreur' });
                }
                return res.json({
                    message: `${url} déjà existante`,
                    url:row.original_url,
                    short_url: row.short_url,
                    nbliens: countRow.nb
                });
            });
            return;
        }

        const isValid=await checkUrl(url);
        if(isValid){

            const short_url = crypto.randomBytes(3).toString('hex');

            db.run('INSERT INTO urls (short_url, original_url, visit) VALUES (?, ?, ?)', [short_url, url, 1], (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Erreur lors de l\'insertion de l\'URL', error: err.message });
                }

                db.get('SELECT * FROM urls where original_url=?',[url],(err,row)=>{
                    if(err){
                        return res.status(404).json({ message: 'Erreur lors de la récupération de l\'URL' });
                    }
                    if(!row){
                        return res.status(404).json({ message: 'URL introuvable après insertion' });
                    }

                    db.get('SELECT COUNT(*) AS nb FROM urls', (err, countRow) => {
                        if (err) {
                            return res.status(404).json({ message: 'erreur' });
                        }
                        return res.json({
                            message: `${url} à été ajouté`,
                            url:row.original_url,
                            short_url:row.short_url,
                            nbliens: countRow.nb
                        });
                    });
                })
                
            });
        }else{

            db.get('SELECT COUNT(*) AS nb FROM urls', (err, countRow) => {
                if (err) {
                    return res.status(404).json({ message: 'erreur' });
                }
                return res.json({
                    message: `${url} est non valide`,
                    nbliens: countRow.nb
                });
            });
        };
    });
});


// Route pour rediriger le lien raccourci
app.get('/:short_url',(req,res)=>{
    const shortUrl=req.params.short_url;

    db.get('SELECT original_url FROM urls WHERE short_url=?',[shortUrl],(err,row)=>{
        if (err){
            return res.status(500).json({ message: 'Erreur lors de la recupération de l\'URL', error: err.message });
        }
        if (row && row.original_url) {
            res.redirect(row.original_url);
        } else {
            // Gérer le cas où row est indéfini ou row.original_url n'existe pas
            res.status(404).send('URL not found');
        }
    })
})

// Route pour supprimer un lien
app.delete("/api/lien/:id", (req, res) => {
    const idlien = req.params.id;

    db.run("DELETE FROM urls WHERE id = ?",[idlien], function (err) {
        if (err) {
            return res.status(500).json({ 
                status: "ERROR", 
                message: 'Erreur lors de la suppression du lien', 
                error: err.message 
            });
        }
        if (this.changes === 0) {
            return res.status(404).json({
                status: "ERROR",
                message: "Aucun lien trouvé avec cet ID."
            });
        }
        return res.status(200).json({
            status: "SUCCESS", 
            message: 'Lien supprimé avec succès.' 
        });
    });
});



// Route pour récupérer les liens
app.get("/api/liens", (req, res, next) => {
    const query = "SELECT * FROM urls";

    db.all(query, [], (err, lignes) => {
        if (err) {
            console.error("Erreur lors de l'exécution de la requête:", err);
            return next(err);
        }
        return res.status(200).json({ status: "SUCCESS", links: lignes });
    });
});



// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Erreur interne du serveur' });
});

// Lancement du serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
